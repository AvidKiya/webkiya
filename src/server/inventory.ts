import "server-only";
import { z } from "zod";
import { db } from "./db";
import { requireStaff, limit } from "./auth";
import { ApiError } from "./http";
import { productLock, reauthorize } from "./product-workflow";
export const stockInput = z
  .object({
    delta: z
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((v) => v !== 0),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
    requestId: z.uuid(),
  })
  .strict();
export async function inventory(request: Request, id: string) {
  await requireStaff(request, "inventory:read");
  if (!(await db().product.findUnique({ where: { id }, select: { id: true } })))
    throw new ApiError(404, "NOT_FOUND", "کالا پیدا نشد.");
  const variants = await db().productVariant.findMany({
    where: { productId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      reserved: true,
      version: true,
      isActive: true,
    },
  });
  const movements = await db().inventoryMovement.findMany({
    where: { variant: { productId: id } },
    take: 30,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      variantId: true,
      delta: true,
      stockAfter: true,
      reason: true,
      createdAt: true,
    },
  });
  return { variants, movements };
}
export async function adjustStock(
  request: Request,
  variantId: string,
  input: z.infer<typeof stockInput>,
) {
  const current = await requireStaff(request, "inventory:manage");
  await limit("inventory:" + current.user.id, 60, 60);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${input.requestId},0))`;
    await reauthorize(tx, current, "inventory:manage");
    const old = await tx.inventoryMovement.findUnique({
      where: { requestId: input.requestId },
    });
    if (old) {
      if (
        old.actorId !== current.user.id ||
        old.variantId !== variantId ||
        old.delta !== input.delta ||
        old.reason !== input.reason ||
        old.beforeVersion !== input.version
      )
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "کلید درخواست برای تغییر دیگری استفاده شده است.",
        );
      return { id: old.id, stock: old.stockAfter, version: old.versionAfter };
    }
    const ref = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { productId: true },
    });
    if (!ref) throw new ApiError(404, "NOT_FOUND", "رنگ پیدا نشد.");
    await productLock(tx, ref.productId);
    await reauthorize(tx, current, "inventory:manage");
    await tx.$queryRaw`SELECT "id" FROM "ProductVariant" WHERE "id"=${variantId}::uuid FOR UPDATE`;
    const v = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
    });
    if (v.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "موجودی تغییر کرده؛ تازه‌سازی کنید.",
      );
    const next = v.stock + input.delta;
    if (next < 0 || next < v.reserved || next > 1000000000)
      throw new ApiError(
        409,
        "INSUFFICIENT_STOCK",
        "تغییر موجودی نباید منفی، کمتر از رزرو یا بیش از سقف باشد.",
      );
    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: next, version: { increment: 1 } },
    });
    const m = await tx.inventoryMovement.create({
      data: {
        variantId,
        actorId: current.user.id,
        requestId: input.requestId,
        delta: input.delta,
        reason: input.reason,
        stockAfter: next,
        beforeVersion: v.version,
        versionAfter: updated.version,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "inventory:adjust",
        resourceId: m.id,
        data: {
          variantId,
          delta: input.delta,
          stockAfter: next,
          reason: input.reason,
          requestId: input.requestId,
        },
      },
    });
    return { id: m.id, stock: next, version: updated.version };
  });
}
