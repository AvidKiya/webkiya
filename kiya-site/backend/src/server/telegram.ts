import { completeTelegramSession } from "./telegram-session";
import { verifiedTelegramPhone } from "./telegram-identity";
import { normalizePhone } from "./identity";
import "server-only";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { hash } from "./crypto";
import { ApiError, ok } from "./http";
import { limit, clientKey, attachCookie, session } from "./auth";
import { integrationConfig, telegramAvailable } from "./settings";
const cookieName = "kiya_telegram_browser";
function proof(r: Request) {
  const value = r.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export const telegramInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("start"),
      mode: z.literal("direct").optional(),
    })
    .strict(),
  z.object({ action: z.enum(["status", "finish"]), id: z.uuid() }).strict(),
]);
export async function telegramLogin(
  r: Request,
  input: z.infer<typeof telegramInput>,
) {
  if (!(await telegramAvailable()))
    throw new ApiError(
      503,
      "TELEGRAM_UNCONFIGURED",
      "ورود تلگرام هنوز در تنظیمات فعال و به ربات متصل نشده است.",
    );
  const existing = await session(r);
  if (existing)
    throw new ApiError(
      409,
      "ALREADY_SIGNED_IN",
      "ابتدا از حساب فعلی خارج شوید؛ حساب‌ها خودکار به هم متصل نمی‌شوند.",
    );
  if (input.action === "start") {
    await limit("telegram-start:" + clientKey(r), 10, 600);
    const selector = randomBytes(24).toString("base64url"),
      browser = randomBytes(32).toString("hex"),
      code = String(randomInt(100000, 1000000));
    const row = await db().telegramLogin.create({
      data: {
        autoApprove: input.mode === "direct",
        selectorHash: hash(selector),
        browserHash: hash(browser),
        displayCode: code,
        expiresAt: new Date(Date.now() + 180000),
      },
    });
    const c = await integrationConfig();
    const response = ok(
      {
        id: row.id,
        code,
        expiresAt: row.expiresAt,
        link: "https://t.me/" + c.username + "?start=login_" + selector,
      },
      201,
    );
    response.cookies.set(cookieName, browser, {
      httpOnly: true,
      sameSite: "lax",
      secure:
        (process.env.NODE_ENV === "production" &&
          process.env.APP_MODE !== "demo") ||
        r.headers.get("x-forwarded-proto") === "https",
      path: "/api/auth/telegram",
      maxAge: 180,
    });
    return response;
  }
  const browser = proof(r);
  if (!browser)
    throw new ApiError(
      401,
      "BROWSER_REQUIRED",
      "درخواست ورود متعلق به این مرورگر نیست.",
    );
  await limit("telegram-poll:" + hash(browser), 90, 180);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TelegramLogin" WHERE id=${input.id}::uuid FOR UPDATE`;
    const row = await tx.telegramLogin.findUnique({ where: { id: input.id } });
    if (!row || row.browserHash !== hash(browser))
      throw new ApiError(404, "NOT_FOUND", "درخواست ورود پیدا نشد.");
    if (row.expiresAt <= new Date() || row.consumedAt)
      throw new ApiError(
        410,
        "LOGIN_EXPIRED",
        "لینک ورود منقضی یا مصرف شده؛ دوباره درخواست بدهید.",
      );
    if (input.action === "status")
      return ok({
        state: row.approvedAt ? "APPROVED" : "WAITING",
        name: row.approvedAt ? row.displayName : null,
        expiresAt: row.expiresAt,
      });
    if (!row.approvedAt || !row.telegramId)
      throw new ApiError(
        409,
        "NOT_APPROVED",
        "ورود را ابتدا داخل ربات تأیید کنید.",
      );
    const response = await completeTelegramSession(
      tx,
      r,
      row.telegramId,
      row.displayName,
      row.verifiedPhone,
      "TELEGRAM",
    );
    await tx.telegramLogin.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return response;
  });
}
const sender = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  is_bot: z.boolean().optional(),
  first_name: z.string().max(256).optional(),
});
export const updateInput = z.object({
  update_id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  message: z
    .object({
      from: sender,
      chat: z.object({ id: z.number().int(), type: z.string() }),
      text: z.string().max(4096).optional(),
      contact: z
        .object({
          user_id: z.number().int().positive().optional(),
          phone_number: z.string().max(30),
        })
        .optional(),
    })
    .optional(),
  callback_query: z
    .object({
      from: sender,
      data: z.string().max(64).optional(),
      message: z
        .object({ chat: z.object({ id: z.number().int(), type: z.string() }) })
        .optional(),
    })
    .optional(),
});
export async function telegramWebhook(r: Request) {
  const c = await integrationConfig(),
    given = r.headers.get("x-telegram-bot-api-secret-token") || "";
  if (
    !c.enabled ||
    !c.secret ||
    Buffer.byteLength(given) !== Buffer.byteLength(c.secret) ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(c.secret))
  )
    throw new ApiError(403, "WEBHOOK_AUTH", "درخواست مجاز نیست.");
}
export async function acceptTelegramUpdate(input: z.infer<typeof updateInput>) {
  const from = input.callback_query?.from || input.message?.from;
  if (from) await limit("telegram-bot:" + from.id, 30, 60);
  return db().$transaction(async (tx) => {
    const inserted =
      await tx.$executeRaw`INSERT INTO "TelegramUpdate"(id) VALUES(${BigInt(input.update_id)}) ON CONFLICT DO NOTHING`;
    if (!inserted) return { accepted: true };
    const msg = input.message,
      callback = input.callback_query,
      from = callback?.from || msg?.from,
      chat = callback?.message?.chat || msg?.chat;
    if (
      !from ||
      from.is_bot ||
      !chat ||
      chat.type !== "private" ||
      chat.id !== from.id
    )
      return { accepted: true };
    if (msg?.contact) {
      if (msg.contact.user_id !== from.id) return { accepted: true };
      const phone = normalizePhone(
        msg.contact.phone_number.startsWith("+")
          ? msg.contact.phone_number
          : "+" + msg.contact.phone_number,
      );
      if (!phone) return { accepted: true };
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "TelegramLogin" WHERE "telegramId"=${BigInt(from.id)} AND "expiresAt">now() AND "approvedAt" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`;

      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${"telegram-user:" + from.id},0))`;
      const user = await tx.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      });
      if (!rows.length && !user) return { accepted: true };
      const collision = await tx.user.findUnique({ where: { phone } });
      if (collision && collision.id !== user?.id) {
        await tx.telegramOutbox.create({
          data: {
            chatId: BigInt(from.id),
            text: "این شماره قبلاً به حساب دیگری متصل است؛ ادغام یا اعطای مدیریت خودکار انجام نشد.",
          },
        });
        return { accepted: true };
      }
      if (rows.length)
        await tx.telegramLogin.update({
          where: { id: rows[0].id },
          data: { verifiedPhone: phone },
        });
      if (user?.isActive && !user.isDemo)
        await verifiedTelegramPhone(tx, user.id, phone);
      await tx.telegramOutbox.create({
        data: {
          chatId: BigInt(from.id),
          text: "شمارهٔ متعلق به همین حساب تلگرام تأیید شد. به مرورگر برگردید؛ اگر نشست قبلی باطل شده، دوباره با لینک تازه وارد شوید. مدیریت فقط با نقش مجاز و MFA باز می‌شود.",
        },
      });
      return { accepted: true };
    }
    const start = msg?.text?.match(
        /^\/start(?:@[A-Za-z0-9_]+)? login_([A-Za-z0-9_-]{32})$/,
      ),
      confirm = callback?.data?.match(/^confirm:([A-Za-z0-9_-]{32})$/);
    const selector = start?.[1] || confirm?.[1];
    if (!selector) {
      if (msg?.text?.trim() === "/logout") {
        const u = await tx.user.findUnique({
          where: { telegramId: BigInt(from.id) },
        });
        if (u)
          await tx.session.updateMany({
            where: { userId: u.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        await tx.telegramOutbox.create({
          data: {
            chatId: BigInt(from.id),
            text: "نشست‌های سایت شما باطل شدند. برای ورود تازه فقط از لینک سایت خودتان استفاده کنید.",
          },
        });
      }
      if (msg?.text?.trim() === "/start") {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${"telegram-user:" + from.id},0))`;
        let u = await tx.user.findUnique({
          where: { telegramId: BigInt(from.id) },
        });
        if (!u)
          u = await tx.user.create({
            data: {
              kind: "CUSTOMER",
              displayName: (from.first_name || "کاربر کیا").slice(0, 80),
              telegramId: BigInt(from.id),
              telegramVerifiedAt: new Date(),
            },
          });
        if (u.isActive && !u.isDemo)
          await tx.telegramOutbox.create({
            data: {
              chatId: BigInt(from.id),
              requestContact: true,
              text: "به کیا خوش آمدید. برای دریافت کد یک‌بارمصرف در تلگرام، شمارهٔ متعلق به همین حساب را با دکمهٔ زیر تأیید کنید؛ سپس در سایت دریافت کد را بزنید. ورود مستقیم از دکمهٔ سایت هم در دسترس است.",
            },
          });
      }
      return { accepted: true };
    }
    const selectorHash = hash(selector);
    await tx.$queryRaw`SELECT id FROM "TelegramLogin" WHERE "selectorHash"=${selectorHash} FOR UPDATE`;
    const row = await tx.telegramLogin.findUnique({ where: { selectorHash } });
    if (
      !row ||
      row.expiresAt <= new Date() ||
      row.consumedAt ||
      (row.telegramId && row.telegramId !== BigInt(from.id))
    ) {
      await tx.telegramOutbox.create({
        data: {
          chatId: BigInt(chat.id),
          text: "لینک ورود نامعتبر، مصرف‌شده یا منقضی است. از سایت لینک تازه بگیرید.",
        },
      });
      return { accepted: true };
    }
    if (confirm && row.autoApprove) return { accepted: true };
    if (start) {
      await tx.telegramLogin.update({
        where: { id: row.id },
        data: {
          telegramId: BigInt(from.id),
          ...(row.autoApprove
            ? { approvedAt: row.approvedAt || new Date() }
            : {}),
          displayName: (from.first_name || "مشتری کیا").slice(0, 80),
        },
      });
      if (row.autoApprove) {
        if (!row.approvedAt)
          await tx.telegramOutbox.create({
            data: {
              chatId: BigInt(chat.id),
              requestContact: true,
              text: "ورود در مرورگری که لینک را ساخته انجام می‌شود؛ به همان صفحه برگردید. اگر درخواست شما نبود /logout را بفرستید. اشتراک شماره فقط برای فعال‌سازی روش OTP یا تأیید شماره است و برای ورود مستقیم لازم نیست.",
            },
          });
        return { accepted: true };
      }
      await tx.telegramOutbox.create({
        data: {
          chatId: BigInt(chat.id),
          text:
            "درخواست ورود به کیا. فقط اگر خودتان در مرورگر کد " +
            row.displayCode +
            " را می‌بینید تأیید کنید. تأیید لینک فرد دیگر، حساب شما را در مرورگر او باز می‌کند. این دکمه فقط ورود را تأیید می‌کند؛ نقش مدیریت جداگانه و شماره فقط با اشتراک تماس خودتان بررسی می‌شود.",
          callback: "confirm:" + selector,
        },
      });
    } else if (row.telegramId === BigInt(from.id)) {
      if (!row.approvedAt)
        await tx.telegramOutbox.create({
          data: {
            chatId: BigInt(chat.id),
            requestContact: true,
            text: "برای تأیید شمارهٔ حساب خودتان و امکان معرفی به مدیریت، دکمهٔ اشتراک شماره را بزنید. فقط تماس متعلق به همین حساب پذیرفته می‌شود. این مرحله برای خرید عادی اختیاری است.",
          },
        });
      if (!row.approvedAt)
        await tx.telegramLogin.update({
          where: { id: row.id },
          data: { approvedAt: new Date() },
        });
      await tx.telegramOutbox.create({
        data: {
          chatId: BigInt(chat.id),
          text: "تأیید شد. به همان مرورگر برگردید، نام حساب را بررسی و دکمه ورود را بزنید. این لینک یک‌بارمصرف است.",
        },
      });
    }
    return { accepted: true };
  });
}
