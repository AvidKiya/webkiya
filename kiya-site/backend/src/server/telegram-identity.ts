import "server-only";
import { type Transaction } from "./db";
import { normalizePhone } from "./identity";
import { ApiError } from "./http";
export async function verifiedTelegramPhone(
  tx: Transaction,
  userId: string,
  phone: string,
) {
  const collision = await tx.user.findUnique({ where: { phone } });
  if (collision && collision.id !== userId)
    throw new ApiError(
      409,
      "PHONE_ALREADY_LINKED",
      "شماره به حساب دیگری متصل است؛ حساب‌ها خودکار ادغام نمی‌شوند.",
    );
  let user = await tx.user.update({
    where: { id: userId },
    data: { phone, phoneVerifiedAt: new Date() },
  });
  const expected =
    process.env.KIYA_BOOTSTRAP_OWNER_PHONE &&
    normalizePhone(process.env.KIYA_BOOTSTRAP_OWNER_PHONE);
  if (
    expected &&
    expected === phone &&
    user.telegramId !== null &&
    user.telegramVerifiedAt &&
    !user.isDemo
  ) {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(27102027)`;
    const existing = await tx.userRole.findFirst({
      where: { role: { key: "OWNER" } },
    });
    if (!existing) {
      const role = await tx.role.findUniqueOrThrow({ where: { key: "OWNER" } });
      user = await tx.user.update({
        where: { id: userId },
        data: { kind: "STAFF", permissionVersion: { increment: 1 } },
      });
      await tx.userRole.create({ data: { userId, roleId: role.id } });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "owner:verified_telegram_bootstrap",
          resourceId: userId,
          data: { source: "private-own-contact", mfaRequired: true },
        },
      });
    }
  }
  return user;
}
