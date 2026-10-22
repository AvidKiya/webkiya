import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { requireStaff, limit } from "./auth";
import { ApiError } from "./http";
export const draftInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    price: z.string().regex(/^(0|[1-9][0-9]{0,13})$/),
  })
  .strict();
export const editDraftInput = draftInput
  .extend({ version: z.number().int().positive() })
  .strict();
const select = {
  id: true,
  name: true,
  price: true,
  status: true,
  version: true,
} as const;
export async function createDraft(
  request: Request,
  input: z.infer<typeof draftInput>,
) {
  const current = await requireStaff(request, "product:write");
  await limit("product-write:" + current.user.id, 30, 60);
  return db().$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        id: "draft-" + randomUUID(),
        name: input.name,
        price: input.price,
        status: "DRAFT",
      },
      select,
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "product:draft_create",
        resourceId: p.id,
        data: { version: p.version },
      },
    });
    return p;
  });
}
export async function editDraft(
  request: Request,
  id: string,
  input: z.infer<typeof editDraftInput>,
) {
  const current = await requireStaff(request, "product:write");
  await limit("product-write:" + current.user.id, 30, 60);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id"=${id} FOR UPDATE`;
    const existing = await tx.product.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "کالا پیدا نشد.");
    if (existing.status !== "DRAFT")
      throw new ApiError(
        409,
        "DRAFT_ONLY",
        "در این مرحله فقط پیش‌نویس قابل ویرایش است؛ قیمت کالای منتشرشده تغییر نمی‌کند.",
      );
    if (existing.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "کالا تغییر کرده است؛ صفحه را تازه کنید.",
      );
    const p = await tx.product.update({
      where: { id },
      data: { name: input.name, price: input.price, version: { increment: 1 } },
      select,
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "product:draft_update",
        resourceId: id,
        data: { version: p.version, fields: ["name", "price"] },
      },
    });
    return p;
  });
}
