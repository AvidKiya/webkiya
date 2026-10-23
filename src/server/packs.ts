import "server-only";
import { z } from "zod";
import { db, type Transaction } from "./db";
import { requireStaff, limit, type Permission, type AuthSession } from "./auth";
import { ApiError } from "./http";
import { productLock, reauthorize } from "./product-workflow";
const component = z
  .object({
    variantId: z.uuid().transform((s) => s.toLowerCase()),
    units: z.number().int().min(1).max(10000),
  })
  .strict();
export const packInput = z
  .object({
    label: z.string().trim().min(2).max(80),
    mode: z.enum(["FIXED_ASSORTMENT", "HOMOGENEOUS"]),
    components: z.array(component).min(1).max(30),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.components.map((p) => p.variantId)).size !== v.components.length
    )
      c.addIssue({ code: "custom", message: "رنگ تکراری" });
    if (v.components.reduce((s, p) => s + p.units, 0) > 10000)
      c.addIssue({ code: "custom", message: "تعداد بیش از حد" });
    if (v.mode === "HOMOGENEOUS" && v.components.length !== 1)
      c.addIssue({ code: "custom", message: "جین هم‌رنگ فقط یک SKU دارد" });
  });
export const editPackInput = packInput.safeExtend({
  version: z.number().int().positive(),
});
export const packStatusInput = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(["ACTIVE", "ARCHIVED"]),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
async function write<T>(
  request: Request,
  id: string,
  permission: Permission,
  work: (
    tx: Transaction,
    current: AuthSession,
    p: Awaited<ReturnType<typeof productLock>>,
  ) => Promise<T>,
) {
  const current = await requireStaff(request, permission);
  await limit("pack-write:" + current.user.id, 40, 60);
  return db().$transaction(async (tx) => {
    const p = await productLock(tx, id);
    await reauthorize(tx, current, permission);
    return work(tx, current, p);
  });
}
const select = {
  id: true,
  label: true,
  mode: true,
  unitsPerPack: true,
  status: true,
  version: true,
  components: {
    orderBy: { variantId: "asc" as const },
    select: {
      variantId: true,
      units: true,
      variant: { select: { name: true, hex: true, isActive: true } },
    },
  },
} as const;
export async function listPacks(request: Request, id: string) {
  await requireStaff(request, "product:read");
  if (!(await db().product.findUnique({ where: { id }, select: { id: true } })))
    throw new ApiError(404, "NOT_FOUND", "کالا پیدا نشد.");
  return {
    items: await db().packDefinition.findMany({
      where: { productId: id },
      select,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
  };
}
async function checkComponents(
  tx: Transaction,
  id: string,
  input: z.infer<typeof packInput>,
) {
  const found = await tx.productVariant.count({
    where: {
      productId: id,
      id: { in: input.components.map((c) => c.variantId) },
      isActive: true,
    },
  });
  if (found !== input.components.length)
    throw new ApiError(
      422,
      "INVALID_COMPONENTS",
      "تمام رنگ‌های جین باید فعال و متعلق به همین کالا باشند.",
    );
}
export async function createPack(
  request: Request,
  id: string,
  input: z.infer<typeof packInput>,
) {
  return write(request, id, "wholesale:pack:manage", async (tx, current, p) => {
    if (p.status !== "DRAFT")
      throw new ApiError(
        409,
        "DRAFT_PRODUCT_REQUIRED",
        "ترکیب جین را در پیش‌نویس کالا تنظیم کنید.",
      );
    if (
      (await tx.packDefinition.count({
        where: { productId: id, status: { not: "ARCHIVED" } },
      })) >= 20
    )
      throw new ApiError(
        422,
        "PACK_LIMIT",
        "حداکثر۲۰تعریف بایگانی‌نشده برای هر کالا.",
      );
    await checkComponents(tx, id, input);
    const created = await tx.packDefinition.create({
      data: {
        productId: id,
        label: input.label,
        mode: input.mode,
        unitsPerPack: input.components.reduce((s, c) => s + c.units, 0),
      },
      select: { id: true },
    });
    await tx.packComponent.createMany({
      data: input.components.map((c) => ({
        ...c,
        productId: id,
        packId: created.id,
      })),
    });
    const pack = await tx.packDefinition.findUniqueOrThrow({
      where: { id: created.id },
      select,
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "pack:create",
        resourceId: pack.id,
        data: {
          productId: id,
          version: pack.version,
          mode: pack.mode,
          unitsPerPack: pack.unitsPerPack,
          components: input.components,
        },
      },
    });
    return pack;
  });
}
export async function editPack(
  request: Request,
  id: string,
  packId: string,
  input: z.infer<typeof editPackInput>,
) {
  return write(request, id, "wholesale:pack:manage", async (tx, current, p) => {
    const old = await tx.packDefinition.findFirst({
      where: { id: packId, productId: id },
    });
    if (!old) throw new ApiError(404, "NOT_FOUND", "تعریف جین پیدا نشد.");
    if (p.status !== "DRAFT" || old.status !== "DRAFT")
      throw new ApiError(
        409,
        "DRAFT_ONLY",
        "فقط تعریف پیش‌نویسِ کالای پیش‌نویس قابل تغییر است؛ برای جین فعال نسخهٔ جایگزین بسازید.",
      );
    if (old.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "جین تغییر کرده؛ تازه‌سازی کنید.",
      );
    await checkComponents(tx, id, input);
    await tx.packComponent.deleteMany({ where: { packId } });
    await tx.packDefinition.update({
      where: { id: packId },
      data: {
        label: input.label,
        mode: input.mode,
        unitsPerPack: input.components.reduce((s, c) => s + c.units, 0),
        version: { increment: 1 },
      },
      select: { id: true },
    });
    await tx.packComponent.createMany({
      data: input.components.map((c) => ({ ...c, productId: id, packId })),
    });
    const updated = await tx.packDefinition.findUniqueOrThrow({
      where: { id: packId },
      select,
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "pack:update",
        resourceId: packId,
        data: {
          productId: id,
          version: updated.version,
          unitsPerPack: updated.unitsPerPack,
          components: input.components,
        },
      },
    });
    return updated;
  });
}
export async function setPackStatus(
  request: Request,
  id: string,
  packId: string,
  input: z.infer<typeof packStatusInput>,
) {
  return write(
    request,
    id,
    "wholesale:pack:publish",
    async (tx, current, p) => {
      const pack = await tx.packDefinition.findFirst({
        where: { id: packId, productId: id },
        include: { components: true },
      });
      if (!pack) throw new ApiError(404, "NOT_FOUND", "تعریف جین پیدا نشد.");
      if (pack.version !== input.version)
        throw new ApiError(
          409,
          "STALE_VERSION",
          "جین تغییر کرده؛ تازه‌سازی کنید.",
        );
      if (!(
        (pack.status === "DRAFT" && input.status === "ACTIVE") ||
        (["DRAFT", "ACTIVE"].includes(pack.status) &&
          input.status === "ARCHIVED")
      ))
        throw new ApiError(
          409,
          "INVALID_TRANSITION",
          "این تغییر وضعیت جین مجاز نیست.",
        );
      if (input.status === "ACTIVE") {
        if (p.status !== "PUBLISHED")
          throw new ApiError(
            409,
            "PUBLISH_PRODUCT_FIRST",
            "ابتدا خود کالا را منتشر کنید.",
          );
        const parsed = packInput.safeParse({
          label: pack.label,
          mode: pack.mode,
          components: pack.components.map((c) => ({
            variantId: c.variantId,
            units: c.units,
          })),
        });
        if (
          !parsed.success ||
          parsed.data.components.reduce((s, c) => s + c.units, 0) !==
            pack.unitsPerPack
        )
          throw new ApiError(422, "INVALID_BOM", "ترکیب جین معتبر نیست.");
        await checkComponents(tx, id, parsed.data);
      }
      const updated = await tx.packDefinition.update({
        where: { id: packId },
        data: { status: input.status, version: { increment: 1 } },
        select,
      });
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          action: "pack:status",
          resourceId: packId,
          data: {
            productId: id,
            from: pack.status,
            to: updated.status,
            version: updated.version,
            reason: input.reason,
          },
        },
      });
      return updated;
    },
  );
}
