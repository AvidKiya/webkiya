import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db, type Transaction } from "./db";
import { requireUser, limit, type AuthSession } from "./auth";
import { ApiError } from "./http";
import { productLock } from "./product-workflow";
import { freshCustomer, partnerLock } from "./wholesale";
export const cartMode = z.enum(["RETAIL", "WHOLESALE"]);
type Mode = z.infer<typeof cartMode>;
const uuid = z.uuid().transform((s) => s.toLowerCase());
export const addCartInput = z
  .object({
    mode: cartMode,
    itemId: uuid,
    quantity: z.number().int().min(1).max(1000),
    requestId: uuid,
  })
  .strict();
export const changeCartInput = z
  .object({
    mode: cartMode,
    lineId: uuid,
    quantity: z.number().int().min(0).max(1000),
    version: z.number().int().positive(),
    requestId: uuid,
  })
  .strict();
export const quoteInput = z
  .object({ mode: cartMode, version: z.number().int().positive() })
  .strict();
async function customer(request: Request) {
  const current = await requireUser(request);
  if (current.user.kind !== "CUSTOMER")
    throw new ApiError(
      403,
      "CUSTOMER_REQUIRED",
      "سبد سروری مخصوص حساب مشتری است.",
    );
  return current;
}
async function lockCart(
  tx: Transaction,
  current: AuthSession,
  mode: Mode,
  create = false,
) {
  if (create)
    await tx.$executeRaw`INSERT INTO "ServerCart"("userId","mode") VALUES(${current.user.id}::uuid,${mode}) ON CONFLICT("userId","mode") DO NOTHING`;
  await tx.$queryRaw`SELECT "id" FROM "ServerCart" WHERE "userId"=${current.user.id}::uuid AND mode=${mode} FOR UPDATE`;
  await freshCustomer(tx, current);
  return tx.serverCart.findUnique({
    where: { userId_mode: { userId: current.user.id, mode } },
  });
}
async function approved(tx: Transaction, current: AuthSession) {
  const ref = await tx.partnerAccount.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });
  if (!ref)
    throw new ApiError(
      403,
      "PARTNER_NOT_APPROVED",
      "همکاری معتبر و قیمت تخصیص‌یافته لازم است.",
    );
  return partnerLock(tx, ref.id);
}
function saleProduct(product: { status: string; isDemo: boolean }) {
  if (product.status !== "PUBLISHED" || product.isDemo)
    throw new ApiError(
      409,
      "PRODUCT_UNAVAILABLE",
      "کالای نامنتشر یا نمونه در سبد سروری قابل محاسبه نیست.",
    );
}
async function pricedPack(tx: Transaction, packId: string, partnerId: string) {
  const now = new Date();
  const offer = await tx.wholesaleOffer.findFirst({
    where: {
      packId,
      partnerId,
      status: "PUBLISHED",
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    include: {
      pack: {
        include: {
          product: true,
          components: {
            orderBy: { variantId: "asc" },
            include: { variant: true },
          },
        },
      },
    },
  });
  if (
    !offer ||
    offer.mode !== "PRICED" ||
    !offer.unitPriceToman ||
    offer.pack.status !== "ACTIVE" ||
    offer.pack.version !== offer.packVersion ||
    !offer.pack.components.length ||
    !offer.pack.components.every((c) => c.variant.isActive)
  )
    throw new ApiError(
      409,
      "WHOLESALE_PRICE_UNAVAILABLE",
      "قیمت و ترکیب جین معتبر نیست؛ تازه‌سازی یا استعلام کنید.",
    );
  saleProduct(offer.pack.product);
  return offer;
}
const linesInclude = {
  variant: { include: { product: true } },
  pack: { include: { product: true } },
} as const;
export async function readCart(request: Request, mode: Mode) {
  const current = await customer(request);
  await limit("cart-read:" + current.user.id, 120, 60);
  return db().$transaction(async (tx) => {
    const cart = await lockCart(tx, current, mode);
    if (!cart)
      return {
        cart: null,
        mode,
        lines: [],
        quoteReady: false,
        orderReady: false,
      };
    const lines = await tx.serverCartLine.findMany({
      where: { cartId: cart.id },
      include: linesInclude,
      orderBy: { id: "asc" },
    });
    return {
      cart: { id: cart.id, version: cart.version },
      mode,
      lines: lines.map((l) => ({
        id: l.id,
        itemId: l.variantId || l.packId,
        quantity: l.quantity,
        productId: (l.variant?.product || l.pack!.product).id,
        name: (l.variant?.product || l.pack!.product).name,
        selection: l.variant?.name || l.pack!.label,
        unitsPerSelection: l.pack?.unitsPerPack || 1,
      })),
      quoteReady: lines.length > 0,
      orderReady: false,
    };
  });
}
async function operation(
  request: Request,
  input: z.infer<typeof addCartInput> | z.infer<typeof changeCartInput>,
  kind: "ADD" | "SET",
) {
  const current = await customer(request);
  await limit("cart-write:" + current.user.id, 60, 60);
  const { requestId, ...body } = input;
  const digest = createHash("sha256")
    .update(JSON.stringify({ userId: current.user.id, kind, ...body }))
    .digest("hex");
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${requestId},0))`;
    const cart = await lockCart(tx, current, input.mode, kind === "ADD");
    if (!cart) throw new ApiError(404, "CART_NOT_FOUND", "سبد خالی است.");
    const old = await tx.cartOperation.findUnique({ where: { requestId } });
    if (old) {
      if (old.cartId !== cart.id || old.digest !== digest)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "این کلید برای تغییر دیگری استفاده شده است.",
        );
      return old.result;
    }
    let lineId: string;
    if ("itemId" in input) {
      let productId: string;
      if (input.mode === "RETAIL") {
        const variant = await tx.productVariant.findUnique({
          where: { id: input.itemId },
          select: { productId: true },
        });
        if (!variant) throw new ApiError(404, "NOT_FOUND", "رنگ پیدا نشد.");
        productId = variant.productId;
      } else {
        const pack = await tx.packDefinition.findUnique({
          where: { id: input.itemId },
          select: { productId: true },
        });
        if (!pack) throw new ApiError(404, "NOT_FOUND", "جین پیدا نشد.");
        productId = pack.productId;
      }
      const product = await productLock(tx, productId);
      await freshCustomer(tx, current);
      saleProduct(product);
      if (input.mode === "RETAIL") {
        if (
          !(await tx.productVariant.findFirst({
            where: { id: input.itemId, productId, isActive: true },
          }))
        )
          throw new ApiError(409, "VARIANT_UNAVAILABLE", "رنگ فعال نیست.");
      } else {
        const partner = await approved(tx, current);
        await pricedPack(tx, input.itemId, partner.id);
      }
      const where = {
        cartId: cart.id,
        ...(input.mode === "RETAIL"
          ? { variantId: input.itemId }
          : { packId: input.itemId }),
      };
      const existing = await tx.serverCartLine.findFirst({ where });
      const quantity = (existing?.quantity || 0) + input.quantity;
      if (quantity > 1000)
        throw new ApiError(
          422,
          "QUANTITY_LIMIT",
          "حداکثر۱۰۰۰انتخاب در هر ردیف مجاز است.",
        );
      if (existing) {
        lineId = existing.id;
        await tx.serverCartLine.update({
          where: { id: lineId },
          data: { quantity },
        });
      } else {
        if (
          (await tx.serverCartLine.count({ where: { cartId: cart.id } })) >= 50
        )
          throw new ApiError(422, "LINE_LIMIT", "حداکثر۵۰ردیف در هر سبد.");
        lineId = (
          await tx.serverCartLine.create({
            data: {
              cartId: cart.id,
              mode: input.mode,
              quantity,
              ...(input.mode === "RETAIL"
                ? { variantId: input.itemId }
                : { packId: input.itemId }),
            },
            select: { id: true },
          })
        ).id;
      }
    } else {
      if (input.version !== cart.version)
        throw new ApiError(
          409,
          "STALE_VERSION",
          "سبد تغییر کرده؛ تازه‌سازی کنید.",
        );
      const line = await tx.serverCartLine.findFirst({
        where: { id: input.lineId, cartId: cart.id },
      });
      if (!line)
        throw new ApiError(404, "NOT_FOUND", "ردیف متعلق به این سبد نیست.");
      lineId = line.id;
      if (input.quantity === 0)
        await tx.serverCartLine.delete({ where: { id: line.id } });
      else
        await tx.serverCartLine.update({
          where: { id: line.id },
          data: { quantity: input.quantity },
        });
    }
    const updated = await tx.serverCart.update({
      where: { id: cart.id },
      data: { version: { increment: 1 } },
      select: { id: true, version: true },
    });
    const result = { cartId: updated.id, version: updated.version, lineId };
    await tx.cartOperation.create({
      data: { requestId, cartId: cart.id, digest, result },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "cart:" + kind.toLowerCase(),
        resourceId: cart.id,
        data: { version: updated.version, lineId, requestId },
      },
    });
    return result;
  });
}
export const addCart = (
  request: Request,
  input: z.infer<typeof addCartInput>,
) => operation(request, input, "ADD");
export const changeCart = (
  request: Request,
  input: z.infer<typeof changeCartInput>,
) => operation(request, input, "SET");
export async function quoteCart(
  request: Request,
  input: z.infer<typeof quoteInput>,
) {
  const current = await customer(request);
  await limit("cart-quote:" + current.user.id, 60, 60);
  return db().$transaction(async (tx) => {
    const cart = await lockCart(tx, current, input.mode);
    if (!cart) throw new ApiError(409, "EMPTY_CART", "سبد خالی است.");
    if (cart.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "سبد تغییر کرده؛ تازه‌سازی کنید.",
      );
    let lines = await tx.serverCartLine.findMany({
      where: { cartId: cart.id },
      include: linesInclude,
      orderBy: { id: "asc" },
    });
    if (!lines.length) throw new ApiError(409, "EMPTY_CART", "سبد خالی است.");
    const productIds = [
      ...new Set(lines.map((l) => (l.variant?.product || l.pack!.product).id)),
    ].sort();
    for (const id of productIds) await productLock(tx, id);
    await freshCustomer(tx, current);
    const partner =
      input.mode === "WHOLESALE" ? await approved(tx, current) : null;
    lines = await tx.serverCartLine.findMany({
      where: { cartId: cart.id },
      include: linesInclude,
      orderBy: { id: "asc" },
    });
    const now = new Date();
    let validUntil = new Date(now.getTime() + 120000);
    if (partner?.expiresAt && partner.expiresAt < validUntil)
      validUntil = partner.expiresAt;
    const required = new Map<string, number>();
    const snapshots = [];
    let subtotal = 0n;
    for (const line of lines) {
      const product = line.variant?.product || line.pack!.product;
      saleProduct(product);
      let unitPrice: string,
        unitsPerSelection: number,
        selection: string,
        packVersion: number | null = null,
        offerId: string | null = null,
        offerVersion: number | null = null;
      const components: { variantId: string; units: number; name: string }[] =
        [];
      if (line.variant) {
        if (!line.variant.isActive || product.price.lte(0))
          throw new ApiError(
            409,
            "VARIANT_UNAVAILABLE",
            "رنگ یا قیمت تکی معتبر نیست.",
          );
        unitPrice = product.price.toString();
        unitsPerSelection = 1;
        selection = line.variant.name;
        components.push({
          variantId: line.variant.id,
          units: 1,
          name: line.variant.name,
        });
      } else {
        const offer = await pricedPack(tx, line.packId!, partner!.id);
        unitPrice = offer.unitPriceToman!.toString();
        unitsPerSelection = offer.pack.unitsPerPack;
        selection = offer.pack.label;
        packVersion = offer.pack.version;
        offerId = offer.id;
        offerVersion = offer.version;
        components.push(
          ...offer.pack.components.map((c) => ({
            variantId: c.variantId,
            units: c.units,
            name: c.variant.name,
          })),
        );
        if (offer.validUntil && offer.validUntil < validUntil)
          validUntil = offer.validUntil;
      }
      for (const c of components)
        required.set(
          c.variantId,
          (required.get(c.variantId) || 0) + c.units * line.quantity,
        );
      const pricePerSelection = BigInt(unitPrice) * BigInt(unitsPerSelection);
      const total = pricePerSelection * BigInt(line.quantity);
      subtotal += total;
      if (subtotal > 99999999999999n)
        throw new ApiError(
          422,
          "AMOUNT_LIMIT",
          "جمع سبد از سقف پولی مجاز بیشتر است.",
        );
      snapshots.push({
        lineId: line.id,
        productId: product.id,
        name: product.name,
        selection,
        quantity: line.quantity,
        unitsPerSelection,
        totalUnits: unitsPerSelection * line.quantity,
        unitPriceToman: unitPrice,
        pricePerSelectionToman: pricePerSelection.toString(),
        lineTotalToman: total.toString(),
        productVersion: product.version,
        packVersion,
        offerId,
        offerVersion,
        components: components.map((c) => ({
          name: c.name,
          unitsPerSelection: c.units,
        })),
      });
    }
    for (const id of [...required.keys()].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "ProductVariant" WHERE "id"=${id}::uuid FOR UPDATE`;
      const variant = await tx.productVariant.findUnique({ where: { id } });
      if (
        !variant ||
        !variant.isActive ||
        variant.stock - variant.reserved < required.get(id)!
      )
        throw new ApiError(
          409,
          "INSUFFICIENT_STOCK",
          "موجودی کل ترکیب سبد کافی نیست؛ تعداد یا ترکیب را اصلاح کنید.",
        );
    }
    if (validUntil <= new Date())
      throw new ApiError(
        409,
        "QUOTE_EXPIRED",
        "اعتبار قیمت یا همکاری پایان یافته؛ دوباره بررسی کنید.",
      );
    return {
      mode: input.mode,
      cartVersion: cart.version,
      generatedAt: now,
      validUntil,
      lines: snapshots,
      subtotalToman: subtotal.toString(),
      shippingToman: null,
      taxToman: null,
      payableToman: null,
      minSelections: 1,
      reserved: false,
      orderReady: false,
      paymentReady: false,
      requiresRevalidation: true,
    };
  });
}
