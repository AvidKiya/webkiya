import "server-only";
import {
  randomBytes,
  randomInt,
  randomUUID,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { normalizePhone, normalizeDigits } from "./identity";
import { hash, encrypt } from "./crypto";
import { ApiError, ok } from "./http";
import { clientKey, limit, session } from "./auth";
import { telegramAvailable } from "./settings";
import { completeTelegramSession } from "./telegram-session";
export const otpInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("otp-start"),
      phone: z
        .string()
        .max(30)
        .transform(normalizePhone)
        .refine((p) => p !== null),
    })
    .strict(),
  z
    .object({
      action: z.literal("otp-verify"),
      id: z.uuid(),
      code: z
        .string()
        .max(12)
        .transform(normalizeDigits)
        .pipe(z.string().regex(/^\d{6}$/)),
    })
    .strict(),
]);
function digest(id: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new ApiError(
      503,
      "AUTH_UNCONFIGURED",
      "احراز هویت میزبان کامل نیست.",
    );
  return createHmac("sha256", secret)
    .update("telegram-otp:" + id + ":" + code)
    .digest("hex");
}
export async function telegramOtp(r: Request, input: z.infer<typeof otpInput>) {
  if (!(await telegramAvailable()))
    throw new ApiError(
      503,
      "TELEGRAM_UNCONFIGURED",
      "ربات هنوز متصل نشده است.",
    );
  if (await session(r))
    throw new ApiError(
      409,
      "ALREADY_SIGNED_IN",
      "ابتدا از حساب فعلی خارج شوید.",
    );
  if (input.action === "otp-start") {
    await limit("telegram-otp-ip:" + clientKey(r), 10, 600);
    await limit("telegram-otp-phone:" + hash(input.phone!), 5, 600);
    const id = randomUUID(),
      code = String(randomInt(100000, 1000000)),
      browser = randomBytes(32).toString("hex"),
      expiresAt = new Date(Date.now() + 180000);
    await db().$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { phone: input.phone! } });
      const eligible = !!(
        user?.telegramId &&
        user.telegramVerifiedAt &&
        user.phoneVerifiedAt &&
        user.isActive &&
        !user.isDemo
      );
      await tx.telegramOtp.create({
        data: {
          id,
          browserHash: hash(browser),
          codeHash: digest(id, code),
          telegramId: eligible ? user!.telegramId : null,
          expiresAt,
        },
      });
      if (eligible)
        await tx.telegramOutbox.create({
          data: {
            chatId: user!.telegramId!,
            text:
              "otp-encrypted:" +
              encrypt(
                "کد یک‌بارمصرف ورود کیا: " +
                  code +
                  "\nاعتبار سه دقیقه. فقط در سایت وارد کنید؛ به کسی ندهید. درخواست نکرده‌اید؟ نادیده بگیرید.",
              ),
          },
        });
    });
    const response = ok(
      {
        id,
        expiresAt,
        message:
          "اگر شماره قبلاً در همین ربات تأیید شده باشد، کد ارسال می‌شود. در ورود اول ربات را Start و شمارهٔ خودتان را تأیید کنید، سپس ارسال مجدد را بزنید.",
      },
      201,
    );
    response.cookies.set("kiya_telegram_browser", browser, {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/auth/telegram",
      maxAge: 180,
      secure:
        (process.env.NODE_ENV === "production" &&
          process.env.APP_MODE !== "demo") ||
        r.headers.get("x-forwarded-proto") === "https",
    });
    return response;
  }
  const browser = r.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("kiya_telegram_browser="))
    ?.slice(22);
  if (!browser || !/^[a-f0-9]{64}$/.test(browser))
    throw new ApiError(
      401,
      "BROWSER_REQUIRED",
      "کد باید در همان مرورگر درخواست‌کننده وارد شود.",
    );
  await limit("telegram-otp-verify:" + hash(browser), 15, 600);
  const result = await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TelegramOtp" WHERE id=${input.id}::uuid FOR UPDATE`;
    const row = await tx.telegramOtp.findUnique({ where: { id: input.id } });
    if (!row || row.browserHash !== hash(browser))
      throw new ApiError(404, "NOT_FOUND", "درخواست کد پیدا نشد.");
    if (row.consumedAt || row.expiresAt <= new Date() || row.attempts >= 5)
      throw new ApiError(
        410,
        "OTP_EXPIRED",
        "کد منقضی، مصرف‌شده یا مسدود شده است؛ دوباره درخواست دهید.",
      );
    await tx.telegramOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    const valid = timingSafeEqual(
      Buffer.from(row.codeHash, "hex"),
      Buffer.from(digest(row.id, input.code), "hex"),
    );
    if (!valid || !row.telegramId) return null;
    const user = await tx.user.findUnique({
      where: { telegramId: row.telegramId },
    });
    if (!user || !user.isActive || user.isDemo || !user.phoneVerifiedAt)
      return null;
    const response = await completeTelegramSession(
      tx,
      r,
      row.telegramId,
      user.displayName,
      null,
      "TELEGRAM_OTP",
    );
    await tx.telegramOtp.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return response;
  });
  if (!result) throw new ApiError(422, "INVALID_CODE", "کد معتبر نیست.");
  return result;
}
