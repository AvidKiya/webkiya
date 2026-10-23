import "server-only";
import { z } from "zod";
import { db, type Transaction } from "./db";
import { requireStaff, limit, type Permission, type AuthSession } from "./auth";
import { ApiError } from "./http";
import { categories } from "@/lib/catalog";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { mediaDirectory } from "./media-storage";
export const mediaPath = /^\/api\/media\/[a-f0-9]{64}$/;
const demoImages = [
  "/images/bag.webp",
  "/images/watch.webp",
  "/images/wallet.webp",
  "/images/glasses.webp",
  "/images/lamp.webp",
];
export const detailsInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    price: z.string().regex(/^(0|[1-9][0-9]{0,13})$/),
    version: z.number().int().positive(),
    subtitle: z.string().trim().max(160),
    category: z
      .string()
      .refine((v) => v === "" || categories.slice(1).includes(v)),
    description: z.string().trim().max(3000),
    imagePath: z
      .string()
      .refine((p) => p === "" || demoImages.includes(p) || mediaPath.test(p)),
    packSize: z.number().int().min(1).max(10000).nullable(),
    tag: z.string().trim().max(40),
    collection: z.string().trim().max(80),
  })
  .strict();
export const variantInput = z
  .object({
    name: z.string().trim().min(1).max(60),
    hex: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,59}$/),
  })
  .strict();
export const variantEditInput = z
  .object({
    name: z.string().trim().min(1).max(60),
    hex: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    isActive: z.boolean(),
    version: z.number().int().positive(),
  })
  .strict();
export const statusInput = z
  .object({
    status: z.enum(["PUBLISHED", "ARCHIVED", "DRAFT"]),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export async function reauthorize(
  tx: Transaction,
  current: AuthSession,
  permission: Permission,
) {
  const s = await tx.session.findUnique({
    where: { id: current.id },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (
    !s ||
    s.revokedAt ||
    s.expiresAt < new Date() ||
    !s.mfaVerified ||
    !s.user.mfaEnabled ||
    !s.user.isActive ||
    s.user.kind !== "STAFF" ||
    s.permissionVersion !== s.user.permissionVersion
  )
    throw new ApiError(401, "SESSION_REVOKED", "نشست معتبر نیست.");
  if (!s.user.roles.some((r) => r.role.permissions.includes(permission)))
    throw new ApiError(403, "FORBIDDEN", "مجوز این عملیات را ندارید.");
}
export async function productLock(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id"=${id} FOR UPDATE`;
  const p = await tx.product.findUnique({ where: { id } });
  if (!p) throw new ApiError(404, "NOT_FOUND", "کالا پیدا نشد.");
  return p;
}
async function mutate<T>(
  request: Request,
  id: string,
  permission: Permission,
  work: (
    tx: Transaction,
    current: AuthSession,
    p: NonNullable<Awaited<ReturnType<typeof productLock>>>,
  ) => Promise<T>,
) {
  const current = await requireStaff(request, permission);
  await limit("catalog-write:" + current.user.id, 60, 60);
  try {
    return await db().$transaction(async (tx) => {
      const p = await productLock(tx, id);
      await reauthorize(tx, current, permission);
      return work(tx, current, p);
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002")
      throw new ApiError(
        409,
        "DUPLICATE_VARIANT",
        "کد SKU یا نام رنگ تکراری است.",
      );
    throw e;
  }
}
export async function productDetails(request: Request, id: string) {
  await requireStaff(request, "product:read");
  const p = await db().product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      price: true,
      status: true,
      version: true,
      subtitle: true,
      category: true,
      description: true,
      imagePath: true,
      packSize: true,
      tag: true,
      collection: true,
      isDemo: true,
      variants: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          hex: true,
          sku: true,
          isActive: true,
          version: true,
        },
      },
    },
  });
  if (!p) throw new ApiError(404, "NOT_FOUND", "کالا پیدا نشد.");
  return p;
}
export async function saveDetails(
  request: Request,
  id: string,
  input: z.infer<typeof detailsInput>,
) {
  return mutate(request, id, "product:write", async (tx, current, p) => {
    if (p.status !== "DRAFT")
      throw new ApiError(
        409,
        "DRAFT_ONLY",
        "ابتدا کالا را بایگانی و به پیش‌نویس برگردانید.",
      );
    if (p.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "کالا تغییر کرده؛ تازه‌سازی کنید.",
      );
    if (
      mediaPath.test(input.imagePath) &&
      !(await tx.mediaAsset.findUnique({
        where: { id: input.imagePath.split("/").pop()! },
      }))
    )
      throw new ApiError(
        422,
        "INVALID_MEDIA",
        "تصویر بارگذاری‌شده معتبر نیست.",
      );
    if (!p.isDemo && demoImages.includes(input.imagePath))
      throw new ApiError(
        422,
        "ORIGINAL_PHOTO_REQUIRED",
        "برای کالای واقعی تصویر اصلی خود را بارگذاری کنید.",
      );
    const { version, ...data } = input;
    void version;
    const updated = await tx.product.update({
      where: { id },
      data: { ...data, previousPrice: null, version: { increment: 1 } },
      select: { id: true, version: true, status: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "product:details",
        resourceId: id,
        data: { version: updated.version },
      },
    });
    return updated;
  });
}
export async function addVariant(
  request: Request,
  id: string,
  input: z.infer<typeof variantInput>,
) {
  return mutate(request, id, "product:write", async (tx, current, p) => {
    if (p.status !== "DRAFT")
      throw new ApiError(
        409,
        "DRAFT_ONLY",
        "رنگ فقط در پیش‌نویس قابل افزودن است.",
      );
    if ((await tx.productVariant.count({ where: { productId: id } })) >= 30)
      throw new ApiError(422, "VARIANT_LIMIT", "حداکثر ۳۰ رنگ برای هر کالا.");
    const v = await tx.productVariant.create({
      data: { ...input, productId: id },
      select: { id: true, version: true },
    });
    await tx.product.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "variant:create",
        resourceId: v.id,
        data: { productId: id },
      },
    });
    return v;
  });
}
export async function editVariant(
  request: Request,
  id: string,
  variantId: string,
  input: z.infer<typeof variantEditInput>,
) {
  return mutate(request, id, "product:write", async (tx, current, p) => {
    if (p.status !== "DRAFT")
      throw new ApiError(
        409,
        "DRAFT_ONLY",
        "رنگ فقط در پیش‌نویس قابل ویرایش است.",
      );
    const v = await tx.productVariant.findFirst({
      where: { id: variantId, productId: id },
    });
    if (!v) throw new ApiError(404, "NOT_FOUND", "رنگ پیدا نشد.");
    if (v.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "رنگ تغییر کرده؛ تازه‌سازی کنید.",
      );
    if (!input.isActive && v.reserved > 0)
      throw new ApiError(
        409,
        "RESERVED_STOCK",
        "رنگ دارای رزرو را نمی‌توان غیرفعال کرد.",
      );
    if (
      await tx.packComponent.count({
        where: { variantId, pack: { status: "ACTIVE" } },
      })
    )
      throw new ApiError(
        409,
        "ACTIVE_PACK_REFERENCE",
        "ابتدا جین‌های فعالِ شامل این رنگ را بایگانی کنید.",
      );
    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: {
        name: input.name,
        hex: input.hex,
        isActive: input.isActive,
        version: { increment: 1 },
      },
      select: { id: true, version: true },
    });
    await tx.product.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "variant:update",
        resourceId: variantId,
        data: { productId: id, isActive: input.isActive },
      },
    });
    return updated;
  });
}
export async function changeStatus(
  request: Request,
  id: string,
  input: z.infer<typeof statusInput>,
) {
  return mutate(request, id, "product:publish", async (tx, current, p) => {
    if (p.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "کالا تغییر کرده؛ تازه‌سازی کنید.",
      );
    if (
      !(
        {
          DRAFT: ["PUBLISHED"],
          PUBLISHED: ["ARCHIVED"],
          ARCHIVED: ["DRAFT"],
        } as Record<string, string[]>
      )[p.status]?.includes(input.status)
    )
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "این تغییر وضعیت مجاز نیست.",
      );
    if (
      input.status !== "PUBLISHED" &&
      (await tx.productVariant.count({
        where: { productId: id, reserved: { gt: 0 } },
      }))
    )
      throw new ApiError(
        409,
        "RESERVED_STOCK",
        "ابتدا رزروهای کالا باید تعیین تکلیف شوند.",
      );
    if (input.status === "PUBLISHED") {
      if (
        !p.subtitle ||
        !categories.slice(1).includes(p.category) ||
        p.description.length < 20 ||
        !p.imagePath ||
        !p.packSize ||
        p.price.lte(0) ||
        !(await tx.productVariant.count({
          where: { productId: id, isActive: true },
        }))
      )
        throw new ApiError(
          422,
          "INCOMPLETE_PRODUCT",
          "انتشار نیاز به عنوان، دسته، توضیح حداقل۲۰نویسه، تصویر، تعداد واحد بسته، قیمت مثبت و یک رنگ فعال دارد.",
        );
      if (!p.isDemo) {
        if (
          !mediaPath.test(p.imagePath) ||
          !(await tx.mediaAsset.findUnique({
            where: { id: p.imagePath.split("/").pop()! },
          }))
        )
          throw new ApiError(
            422,
            "ORIGINAL_PHOTO_REQUIRED",
            "تصویر اصلی کالا لازم است.",
          );
        try {
          await access(
            join(mediaDirectory(), p.imagePath.split("/").pop()! + ".webp"),
          );
        } catch {
          throw new ApiError(422, "MEDIA_MISSING", "فایل تصویر در دسترس نیست.");
        }
      }
    }
    const updated = await tx.product.update({
      where: { id },
      data: { status: input.status, version: { increment: 1 } },
      select: { id: true, status: true, version: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "product:status",
        resourceId: id,
        data: {
          from: p.status,
          to: input.status,
          reason: input.reason,
          version: updated.version,
        },
      },
    });
    return updated;
  });
}
