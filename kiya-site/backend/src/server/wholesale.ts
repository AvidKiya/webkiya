import "server-only";
import { z } from "zod";
import { db, type Transaction } from "./db";
import { requireStaff, requireUser, limit, type AuthSession } from "./auth";
import { productLock, reauthorize } from "./product-workflow";
import { ApiError } from "./http";
const uuid = z.uuid().transform((s) => s.toLowerCase());
export const offerInput = z
  .object({
    packId: uuid,
    partnerId: uuid,
    mode: z.enum(["PRICED", "INQUIRY"]),
    unitPriceToman: z
      .string()
      .regex(/^[1-9][0-9]{0,13}$/)
      .nullable(),
    validFrom: z.iso.datetime(),
    validUntil: z.iso.datetime().nullable(),
    reason: z.string().trim().min(3).max(500),
    requestId: uuid,
  })
  .strict()
  .superRefine((v, c) => {
    if ((v.mode === "INQUIRY") !== (v.unitPriceToman === null))
      c.addIssue({ code: "custom", message: "حالت قیمت معتبر نیست" });
    if (v.validUntil && Date.parse(v.validUntil) <= Date.parse(v.validFrom))
      c.addIssue({ code: "custom", message: "بازهٔ اعتبار معتبر نیست" });
  });
export const offerStatusInput = z
  .object({
    status: z.enum(["PUBLISHED", "ARCHIVED"]),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export const validityInput = z
  .object({
    expiresAt: z.iso.datetime().nullable(),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
const offerSelect = {
  id: true,
  packId: true,
  partnerId: true,
  packVersion: true,
  mode: true,
  unitPriceToman: true,
  validFrom: true,
  validUntil: true,
  status: true,
  version: true,
  createdBy: true,
  reviewerId: true,
  reason: true,
  partner: { select: { businessName: true } },
  pack: { select: { label: true, unitsPerPack: true } },
} as const;
function eligible(
  p: { status: string; expiresAt: Date | null },
  now = new Date(),
) {
  return p.status === "APPROVED" && (!p.expiresAt || p.expiresAt > now);
}
export async function partnerLock(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "PartnerAccount" WHERE "id"=${id}::uuid FOR SHARE`;
  const p = await tx.partnerAccount.findUnique({
    where: { id },
    include: { user: true },
  });
  if (
    !p ||
    !eligible(p) ||
    !p.user.isActive ||
    p.user.kind !== "CUSTOMER" ||
    (!p.user.phoneVerifiedAt &&
      !(p.user.isDemo && process.env.APP_MODE === "demo")) ||
    (p.user.isDemo && process.env.APP_MODE !== "demo")
  )
    throw new ApiError(
      403,
      "PARTNER_NOT_APPROVED",
      "همکاری معتبر و حساب مشتری با شمارهٔ تأییدشده لازم است؛ حساب مصنوعی فقط در demo مجاز است.",
    );
  return p;
}
export async function offerContext(request: Request, id: string) {
  const current = await requireStaff(request, "wholesale:price:read");
  if (!(await db().product.findUnique({ where: { id }, select: { id: true } })))
    throw new ApiError(404, "NOT_FOUND", "کالا پیدا نشد.");
  const now = new Date();
  const [packs, partners, items] = await Promise.all([
    db().packDefinition.findMany({
      where: { productId: id, status: "ACTIVE" },
      select: { id: true, label: true, version: true, unitsPerPack: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db().partnerAccount.findMany({
      where: {
        status: "APPROVED",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        user: {
          kind: "CUSTOMER",
          isActive: true,
          ...(process.env.APP_MODE !== "demo"
            ? { isDemo: false, phoneVerifiedAt: { not: null } }
            : { OR: [{ phoneVerifiedAt: { not: null } }, { isDemo: true }] }),
        },
      },
      select: {
        id: true,
        businessName: true,
        user: { select: { isDemo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db().wholesaleOffer.findMany({
      where: { productId: id },
      select: offerSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
  ]);
  return { packs, partners, items, actorId: current.user.id };
}
export async function createOffer(
  request: Request,
  id: string,
  input: z.infer<typeof offerInput>,
) {
  const current = await requireStaff(request, "wholesale:price:manage");
  await limit("price-write:" + current.user.id, 40, 60);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.requestId},0))`;
    const product = await productLock(tx, id);
    await reauthorize(tx, current, "wholesale:price:manage");
    const previous = await tx.wholesaleOffer.findUnique({
      where: { requestId: input.requestId },
      select: { ...offerSelect, productId: true },
    });
    if (previous) {
      if (
        previous.createdBy !== current.user.id ||
        previous.productId !== id ||
        previous.packId !== input.packId ||
        previous.partnerId !== input.partnerId ||
        previous.mode !== input.mode ||
        (previous.unitPriceToman?.toString() ?? null) !==
          input.unitPriceToman ||
        previous.validFrom.getTime() !== Date.parse(input.validFrom) ||
        (previous.validUntil?.getTime() ?? null) !==
          (input.validUntil ? Date.parse(input.validUntil) : null) ||
        previous.reason !== input.reason
      )
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "این کلید برای ثبت قیمت دیگری استفاده شده است.",
        );
      const { productId, ...dto } = previous;
      void productId;
      return dto;
    }
    if (product.status !== "PUBLISHED")
      throw new ApiError(
        409,
        "PUBLISHED_PRODUCT_REQUIRED",
        "ابتدا کالا و جین را فعال کنید.",
      );
    await partnerLock(tx, input.partnerId);
    const pack = await tx.packDefinition.findFirst({
      where: { id: input.packId, productId: id, status: "ACTIVE" },
    });
    if (!pack)
      throw new ApiError(
        422,
        "ACTIVE_PACK_REQUIRED",
        "جین فعال همین کالا را انتخاب کنید.",
      );
    if (input.validUntil && Date.parse(input.validUntil) <= Date.now())
      throw new ApiError(422, "EXPIRED_PRICE", "قیمت منقضی قابل ثبت نیست.");
    if (
      input.unitPriceToman &&
      BigInt(input.unitPriceToman) * BigInt(pack.unitsPerPack) > 99999999999999n
    )
      throw new ApiError(
        422,
        "AMOUNT_LIMIT",
        "مبلغ یک جین از سقف پولی مجاز بیشتر است.",
      );
    if (
      (await tx.wholesaleOffer.count({
        where: {
          partnerId: input.partnerId,
          packId: input.packId,
          status: "DRAFT",
        },
      })) >= 20
    )
      throw new ApiError(
        422,
        "DRAFT_LIMIT",
        "ابتدا پیش‌نویس‌های قبلی این همکار و جین را بررسی کنید.",
      );
    const offer = await tx.wholesaleOffer.create({
      data: {
        ...input,
        productId: id,
        packVersion: pack.version,
        validFrom: new Date(input.validFrom),
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        createdBy: current.user.id,
      },
      select: offerSelect,
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "wholesale:price:create",
        resourceId: offer.id,
        data: {
          productId: id,
          requestId: input.requestId,
          reason: input.reason,
        },
      },
    });
    return offer;
  });
}
export async function setOfferStatus(
  request: Request,
  id: string,
  offerId: string,
  input: z.infer<typeof offerStatusInput>,
) {
  const current = await requireStaff(request, "wholesale:price:publish");
  await limit("price-review:" + current.user.id, 40, 60);
  return db().$transaction(async (tx) => {
    const product = await productLock(tx, id);
    await reauthorize(tx, current, "wholesale:price:publish");
    const offer = await tx.wholesaleOffer.findFirst({
      where: { id: offerId, productId: id },
      include: { pack: true },
    });
    if (!offer) throw new ApiError(404, "NOT_FOUND", "قیمت پیدا نشد.");
    if (offer.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "پروندهٔ قیمت تغییر کرده؛ تازه‌سازی کنید.",
      );
    if (!(
      (offer.status === "DRAFT" &&
        ["PUBLISHED", "ARCHIVED"].includes(input.status)) ||
      (offer.status === "PUBLISHED" && input.status === "ARCHIVED")
    ))
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "این تغییر وضعیت قیمت مجاز نیست.",
      );
    if (input.status === "PUBLISHED") {
      if (offer.createdBy === current.user.id)
        throw new ApiError(
          403,
          "SELF_APPROVAL",
          "قیمت را پرسنل مجاز دیگری باید تأیید کند؛ ثبت‌کننده نمی‌تواند قیمت خودش را منتشر کند.",
        );
      await partnerLock(tx, offer.partnerId);
      if (
        product.status !== "PUBLISHED" ||
        offer.pack.status !== "ACTIVE" ||
        offer.packVersion !== offer.pack.version
      )
        throw new ApiError(
          409,
          "PACK_CHANGED",
          "کالا یا جین معتبر نیست؛ تعریف و قیمت جدید لازم است.",
        );
      if (offer.validUntil && offer.validUntil <= new Date())
        throw new ApiError(
          422,
          "EXPIRED_PRICE",
          "قیمت منقضی قابل انتشار نیست.",
        );
      if (
        await tx.wholesaleOffer.count({
          where: {
            partnerId: offer.partnerId,
            packId: offer.packId,
            status: "PUBLISHED",
          },
        })
      )
        throw new ApiError(
          409,
          "PRICE_CONFLICT",
          "ابتدا قیمت منتشرشدهٔ قبلی همین همکار و جین را بایگانی کنید.",
        );
    }
    const updated = await tx.wholesaleOffer.update({
      where: { id: offerId },
      data: {
        status: input.status,
        version: { increment: 1 },
        ...(input.status === "PUBLISHED"
          ? { reviewerId: current.user.id }
          : {}),
      },
      select: offerSelect,
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "wholesale:price:status",
        resourceId: offerId,
        data: {
          productId: id,
          from: offer.status,
          to: input.status,
          version: updated.version,
          reason: input.reason,
        },
      },
    });
    return updated;
  });
}
export async function setPartnerValidity(
  request: Request,
  id: string,
  input: z.infer<typeof validityInput>,
) {
  const current = await requireStaff(request, "partner:approve");
  await limit("partner-validity:" + current.user.id, 30, 60);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PartnerAccount" WHERE "id"=${id}::uuid FOR UPDATE`;
    await reauthorize(tx, current, "partner:approve");
    const p = await tx.partnerAccount.findUnique({ where: { id } });
    if (!p) throw new ApiError(404, "NOT_FOUND", "پرونده پیدا نشد.");
    if (p.userId === current.user.id)
      throw new ApiError(
        403,
        "SELF_APPROVAL",
        "تغییر اعتبار همکاری خودتان مجاز نیست.",
      );
    if (p.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "پرونده تغییر کرده؛ تازه‌سازی کنید.",
      );
    if (p.status !== "APPROVED")
      throw new ApiError(
        409,
        "APPROVED_REQUIRED",
        "تنظیم اعتبار فقط برای همکار تأییدشده است.",
      );
    const updated = await tx.partnerAccount.update({
      where: { id },
      data: {
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        version: { increment: 1 },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "partner:validity",
        resourceId: id,
        data: {
          expiresAt: input.expiresAt,
          version: updated.version,
          reason: input.reason,
        },
      },
    });
    return { id, expiresAt: updated.expiresAt, version: updated.version };
  });
}
export async function freshCustomer(tx: Transaction, current: AuthSession) {
  const s = await tx.session.findUnique({
    where: { id: current.id },
    include: { user: true },
  });
  if (
    !s ||
    s.revokedAt ||
    s.expiresAt <= new Date() ||
    !s.user.isActive ||
    s.permissionVersion !== s.user.permissionVersion ||
    (s.user.isDemo && process.env.APP_MODE !== "demo")
  )
    throw new ApiError(401, "AUTH_REQUIRED", "نشست معتبر نیست.");
  if (
    !s.user.phoneVerifiedAt && !s.user.telegramVerifiedAt &&
    !(s.user.isDemo && process.env.APP_MODE === "demo")
  )
    throw new ApiError(403, "PHONE_REQUIRED", "تأیید شمارهٔ مشتری لازم است.");
  if (s.user.kind !== "CUSTOMER")
    throw new ApiError(
      403,
      "CUSTOMER_REQUIRED",
      "قیمت همکاری فقط برای حساب مشتری مجاز است.",
    );
}
export async function privateWholesaleCatalog(request: Request) {
  const current = await requireUser(request);
  if (current.user.kind !== "CUSTOMER")
    throw new ApiError(
      403,
      "CUSTOMER_REQUIRED",
      "این بخش فقط برای حساب همکار مشتری است.",
    );
  await limit("wholesale-read:" + current.user.id, 120, 60);
  return db().$transaction(async (tx) => {
    const ref = await tx.partnerAccount.findUnique({
      where: { userId: current.user.id },
      select: { id: true },
    });
    if (!ref)
      throw new ApiError(
        403,
        "PARTNER_NOT_APPROVED",
        "برای قیمت عمده، تأیید همکاری لازم است.",
      );
    const partner = await partnerLock(tx, ref.id);
    await freshCustomer(tx, current);
    const now = new Date();
    const offers = await tx.wholesaleOffer.findMany({
      where: {
        partnerId: partner.id,
        status: "PUBLISHED",
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        pack: {
          status: "ACTIVE",
          product: {
            status: "PUBLISHED",
            ...(process.env.APP_MODE !== "demo" ? { isDemo: false } : {}),
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
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
    return {
      items: offers
        .filter(
          (o) =>
            o.packVersion === o.pack.version &&
            o.pack.components.length > 0 &&
            o.pack.components.every((c) => c.variant.isActive),
        )
        .map((o) => {
          const p = o.pack;
          const base = {
            product: {
              id: p.product.id,
              name: p.product.name,
              image: p.product.imagePath,
              retailPriceToman: p.product.price.toString(),
              isDemo: p.product.isDemo,
            },
            pack: {
              id: p.id,
              label: p.label,
              mode: p.mode,
              version: p.version,
              unitsPerPack: p.unitsPerPack,
              components: p.components.map((c) => ({
                name: c.variant.name,
                hex: c.variant.hex,
                units: c.units,
              })),
            },
            offerId: o.id,
            offerVersion: o.version,
            validUntil: o.validUntil,
            available: p.components.every(
              (c) => c.variant.stock - c.variant.reserved >= c.units,
            ),
            pricing: o.mode,
          };
          return o.mode === "PRICED" && o.unitPriceToman
            ? {
                ...base,
                unitPriceToman: o.unitPriceToman.toString(),
                packPriceToman: (
                  BigInt(o.unitPriceToman.toString()) * BigInt(p.unitsPerPack)
                ).toString(),
              }
            : base;
        }),
      accessExpiresAt: partner.expiresAt,
      minPacks: 1,
      minAmountToman: "0",
      orderReady: false,
    };
  });
}
