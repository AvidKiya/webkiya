import "server-only";
import { z } from "zod";
import { db } from "./db";
import { reauthorize } from "./product-workflow";
import { ApiError } from "./http";
import { requireUser, requireStaff, limit } from "./auth";
export const partnerInput = z
  .object({
    businessName: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(80),
    note: z.string().trim().min(5).max(500),
  })
  .strict();
export const reviewInput = z
  .object({
    status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export async function applyPartner(
  request: Request,
  input: z.infer<typeof partnerInput>,
) {
  const current = await requireUser(request);
  if (current.user.kind !== "CUSTOMER")
    throw new ApiError(
      403,
      "CUSTOMER_REQUIRED",
      "این بخش برای حساب مشتری است.",
    );
  if (!current.user.phoneVerifiedAt && !current.user.isDemo)
    throw new ApiError(403, "PHONE_REQUIRED", "تأیید شماره لازم است.");
  await limit("partner:" + current.user.id, 5, 3600);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${current.user.id}::uuid FOR UPDATE`;
    const existing = await tx.partnerAccount.findUnique({
      where: { userId: current.user.id },
    });
    if (existing)
      throw new ApiError(
        409,
        "APPLICATION_EXISTS",
        "درخواست قبلی ثبت شده است؛ وضعیت آن را بررسی کنید.",
      );
    const partner = await tx.partnerAccount.create({
      data: { ...input, userId: current.user.id },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "partner:apply",
        resourceId: partner.id,
        data: { isDemo: current.user.isDemo },
      },
    });
    return { id: partner.id, status: partner.status, version: partner.version };
  });
}
export async function reviewPartner(
  request: Request,
  id: string,
  input: z.infer<typeof reviewInput>,
) {
  const permission =
    input.status === "APPROVED"
      ? "partner:approve"
      : input.status === "SUSPENDED"
        ? "partner:suspend"
        : "partner:review";
  const current = await requireStaff(request, permission);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PartnerAccount" WHERE "id"=${id}::uuid FOR UPDATE`;
    await reauthorize(tx, current, permission);
    const p = await tx.partnerAccount.findUnique({ where: { id } });
    if (!p) throw new ApiError(404, "NOT_FOUND", "درخواست پیدا نشد.");
    if (p.userId === current.user.id)
      throw new ApiError(
        403,
        "SELF_APPROVAL",
        "بررسی درخواست خودتان مجاز نیست.",
      );
    if (p.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "این پرونده تغییر کرده؛ صفحه را تازه کنید.",
      );
    const valid =
      (p.status === "PENDING" &&
        ["APPROVED", "REJECTED"].includes(input.status)) ||
      (p.status === "APPROVED" && input.status === "SUSPENDED") ||
      (p.status === "SUSPENDED" && input.status === "APPROVED");
    if (!valid)
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "این تغییر وضعیت مجاز نیست.",
      );
    const updated = await tx.partnerAccount.update({
      where: { id },
      data: {
        status: input.status,
        reason: input.reason,
        reviewerId: current.user.id,
        version: { increment: 1 },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: permission,
        resourceId: id,
        data: {
          from: p.status,
          to: input.status,
          version: updated.version,
          reason: input.reason,
        },
      },
    });
    return { id, status: updated.status, version: updated.version };
  });
}
