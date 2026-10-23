import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "./db";
import { customer, calculateCart, quoteInput } from "./cart";
import { freshCustomer } from "./wholesale";
import { limit } from "./auth";
import { ApiError } from "./http";
import type { PurchaseOrder } from "@/generated/prisma/client";
export const orderInput = quoteInput
  .extend({
    requestId: z.uuid().transform((s) => s.toLowerCase()),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const cancelInput = z
  .object({ version: z.number().int().positive() })
  .strict();
export const orderId = z.uuid();
function dto(order: PurchaseOrder) {
  return {
    id: order.id,
    mode: order.mode,
    status: order.status,
    version: order.version,
    reservedUntil: order.reservedUntil,
    createdAt: order.createdAt,
    endedAt: order.endedAt,
    subtotalToman: order.subtotalToman.toString(),
    snapshot: order.snapshot,
    payableToman: null,
    paymentReady: false,
    fulfillmentReady: false,
  };
}
// Each release is a separate transaction; never retain SKU locks across orders.
export async function releaseExpiredOrders(batch = 50) {
  const due = await db().purchaseOrder.findMany({
    where: { status: "RESERVED", reservedUntil: { lte: new Date() } },
    orderBy: [{ reservedUntil: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(batch, 1), 100),
    select: { id: true },
  });
  for (const order of due)
    await db()
      .$queryRaw`SELECT kiya_release_order(${order.id}::uuid,'EXPIRED',NULL) AS released`;
  return due.length;
}
export async function createOrder(
  request: Request,
  input: z.infer<typeof orderInput>,
) {
  const current = await customer(request);
  await limit("order-create:" + current.user.id, 10, 60);
  // Recheck before any lazy maintenance. Only time-expired holds can be released.
  await db().$transaction((tx) => freshCustomer(tx, current));
  await releaseExpiredOrders();
  const digest = createHash("sha256")
    .update(JSON.stringify({ userId: current.user.id, ...input }))
    .digest("hex");
  return db().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.requestId},0))`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${"order-user:" + current.user.id},0))`;
      await freshCustomer(tx, current);
      const prior = await tx.purchaseOrder.findUnique({
        where: { requestId: input.requestId },
      });
      if (prior) {
        if (prior.userId !== current.user.id || prior.digest !== digest)
          throw new ApiError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "کلید درخواست قبلاً برای سفارش دیگری استفاده شده است.",
          );
        return dto(prior);
      }
      if (
        (await tx.purchaseOrder.count({
          where: { userId: current.user.id, status: "RESERVED" },
        })) >= 3
      )
        throw new ApiError(
          409,
          "ACTIVE_ORDER_LIMIT",
          "حداکثر سه رزرو فعال مجاز است؛ ابتدا رزرو قبلی را لغو کنید.",
        );
      const { quote, required, cart } = await calculateCart(tx, current, input);
      if (quote.fingerprint !== input.fingerprint)
        throw new ApiError(
          409,
          "PRICE_REVIEW_REQUIRED",
          "قیمت یا مشخصات تغییر کرده؛ محاسبهٔ تازه را ببینید و دوباره تأیید کنید.",
        );
      if (quote.validUntil.getTime() - Date.now() < 5000)
        throw new ApiError(
          409,
          "VALIDITY_TOO_SHORT",
          "اعتبار همکاری یا قیمت در حال پایان است؛ تمدید و دوباره محاسبه کنید.",
        );
      const order = await tx.purchaseOrder.create({
        data: {
          userId: current.user.id,
          cartId: cart.id,
          cartVersion: cart.version,
          mode: input.mode,
          requestId: input.requestId,
          digest,
          snapshot: JSON.parse(JSON.stringify(quote)),
          subtotalToman: quote.subtotalToman,
          reservedUntil: quote.validUntil,
        },
      });
      for (const [variantId, units] of [...required.entries()].sort(
        ([a], [b]) => a.localeCompare(b),
      )) {
        // calculateCart holds every SKU row lock through this commit.
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: variantId },
        });
        const updated = await tx.productVariant.update({
          where: { id: variantId },
          data: { reserved: { increment: units }, version: { increment: 1 } },
        });
        await tx.orderHold.create({
          data: { orderId: order.id, variantId, units },
        });
        await tx.reservationMovement.create({
          data: {
            orderId: order.id,
            variantId,
            kind: "RESERVE",
            delta: units,
            reservedAfter: updated.reserved,
            beforeVersion: variant.version,
            versionAfter: updated.version,
          },
        });
      }
      await tx.serverCartLine.deleteMany({ where: { cartId: cart.id } });
      await tx.serverCart.update({
        where: { id: cart.id },
        data: { version: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          action: "order:reserve",
          resourceId: order.id,
          data: {
            cartId: cart.id,
            cartVersion: cart.version,
            requestId: input.requestId,
          },
        },
      });
      return dto(order);
    },
    { timeout: 15000 },
  );
}
export async function listOrders(request: Request) {
  const current = await customer(request);
  await limit("orders-read:" + current.user.id, 60, 60);
  await db().$transaction((tx) => freshCustomer(tx, current));
  const due = await db().purchaseOrder.findMany({
    where: {
      userId: current.user.id,
      status: "RESERVED",
      reservedUntil: { lte: new Date() },
    },
    select: { id: true },
    take: 50,
  });
  for (const o of due)
    await db()
      .$queryRaw`SELECT kiya_release_order(${o.id}::uuid,'EXPIRED',NULL) AS released`;
  return db().$transaction(async (tx) => {
    await freshCustomer(tx, current);
    return {
      orders: (
        await tx.purchaseOrder.findMany({
          where: { userId: current.user.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
        })
      ).map(dto),
      limit: 50,
    };
  });
}
export async function cancelOrder(
  request: Request,
  id: string,
  input: z.infer<typeof cancelInput>,
) {
  const current = await customer(request);
  await limit("order-cancel:" + current.user.id, 30, 60);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${id}::uuid AND "userId"=${current.user.id}::uuid FOR UPDATE`;
    await freshCustomer(tx, current);
    const order = await tx.purchaseOrder.findFirst({
      where: { id, userId: current.user.id },
    });
    if (!order) throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
    if (order.status !== "RESERVED") return dto(order);
    if (order.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "سفارش تغییر کرده؛ تازه‌سازی کنید.",
      );
    const status = order.reservedUntil <= new Date() ? "EXPIRED" : "CANCELLED";
    await tx.$queryRaw`SELECT kiya_release_order(${id}::uuid,${status},${current.user.id}::uuid) AS released`;
    return dto(await tx.purchaseOrder.findUniqueOrThrow({ where: { id } }));
  });
}
