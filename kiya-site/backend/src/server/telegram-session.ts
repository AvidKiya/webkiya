import "server-only";
import { randomBytes } from "node:crypto";
import { hash } from "./crypto";
import { ApiError, ok } from "./http";
import { attachCookie } from "./auth";
import { verifiedTelegramPhone } from "./telegram-identity";
import { type Transaction } from "./db";
export async function completeTelegramSession(
  tx: Transaction,
  r: Request,
  telegramId: bigint,
  displayName: string | null,
  phone: string | null,
  method: string,
) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${"telegram-user:" + telegramId},0))`;
  let user = await tx.user.findUnique({ where: { telegramId } });
  if (user && (!user.isActive || user.isDemo))
    throw new ApiError(403, "ACCOUNT_DISABLED", "این حساب مجاز به ورود نیست.");
  if (!user)
    user = await tx.user.create({
      data: {
        kind: "CUSTOMER",
        displayName: displayName || "کاربر کیا",
        telegramId,
        telegramVerifiedAt: new Date(),
      },
    });
  if (phone) user = await verifiedTelegramPhone(tx, user.id, phone);
  const token = randomBytes(32).toString("hex");
  await tx.session.create({
    data: {
      userId: user.id,
      permissionVersion: user.permissionVersion,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 8 * 3600000),
    },
  });
  await tx.auditLog.create({
    data: {
      actorId: user.id,
      action: "auth:telegram_login",
      resourceId: user.id,
      data: { method },
    },
  });
  const response = attachCookie(ok({ authenticated: true }), token, r);
  response.cookies.set("kiya_telegram_browser", "", {
    path: "/api/auth/telegram",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}
