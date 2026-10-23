import "server-only";
import { limit } from "./auth";
import { z } from "zod";
import { db } from "./db";
import { encrypt, decrypt } from "./crypto";
import { requireOwner } from "./access";
import { reauthorize } from "./product-workflow";
import { ApiError } from "./http";
export function validCard(card: string) {
  if (!/^\d{16}$/.test(card) || /^(\d)\1{15}$/.test(card)) return false;
  return (
    [...card].reduce((sum, c, i) => {
      const n = Number(c) * (i % 2 === 0 ? 2 : 1);
      return sum + (n > 9 ? n - 9 : n);
    }, 0) %
      10 ===
    0
  );
}
const amount = z.string().regex(/^\d{1,13}$/);
export const settingsInput = z
  .object({
    version: z.number().int().min(0),
    telegramEnabled: z.boolean(),
    botUsername: z
      .string()
      .min(5)
      .max(32)
      .regex(/^[A-Za-z][A-Za-z0-9_]*bot$/i),
    botToken: z
      .string()
      .regex(/^\d{5,20}:[A-Za-z0-9_-]{30,100}$/)
      .nullable()
      .optional(),
    webhookSecret: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,128}$/)
      .nullable()
      .optional(),
    cardEnabled: z.boolean(),
    bankName: z.string().trim().max(80),
    cardNumber: z.string().max(16),
    cardHolder: z.string().trim().max(100),
    shippingToman: amount,
    taxToman: amount,
    transferMinutes: z.number().int().min(15).max(1440),
  })
  .strict();
export async function integrationConfig() {
  const s = await db().storeSettings.findUnique({ where: { id: 1 } });
  return {
    settings: s,
    enabled:
      s?.telegramEnabled ?? process.env.TELEGRAM_LOGIN_ENABLED === "true",
    username: s?.botUsername || "kiyaco24bot",
    token: s?.botTokenEncrypted
      ? decrypt(s.botTokenEncrypted)
      : process.env.TELEGRAM_BOT_TOKEN,
    secret: s?.webhookSecretEncrypted
      ? decrypt(s.webhookSecretEncrypted)
      : process.env.TELEGRAM_WEBHOOK_SECRET,
  };
}
export async function readSettings(request: Request) {
  await requireOwner(request);
  const s = await db().storeSettings.findUnique({ where: { id: 1 } });
  return {
    version: s?.version || 0,
    telegramEnabled:
      s?.telegramEnabled ?? process.env.TELEGRAM_LOGIN_ENABLED === "true",
    botUsername: s?.botUsername || "kiyaco24bot",
    botTokenConfigured: !!(
      s?.botTokenEncrypted || process.env.TELEGRAM_BOT_TOKEN
    ),
    webhookSecretConfigured: !!(
      s?.webhookSecretEncrypted || process.env.TELEGRAM_WEBHOOK_SECRET
    ),
    cardEnabled: s?.cardEnabled || false,
    bankName: s?.bankName || "",
    cardNumber: s?.cardNumber || "",
    cardHolder: s?.cardHolder || "",
    shippingToman: s?.shippingToman.toString() || "0",
    taxToman: s?.taxToman.toString() || "0",
    transferMinutes: s?.transferMinutes || 60,
  };
}
export async function saveSettings(
  request: Request,
  input: z.infer<typeof settingsInput>,
) {
  const actor = await requireOwner(request);
  await limit("settings-write:" + actor.user.id, 20, 60);
  if (
    input.cardEnabled &&
    (!validCard(input.cardNumber) ||
      input.bankName.length < 2 ||
      input.cardHolder.length < 2)
  )
    throw new ApiError(
      422,
      "BANK_SETTINGS",
      "شماره کارت و نام بانک و صاحب حساب را کامل و صحیح وارد کنید.",
    );
  return db().$transaction(async (tx) => {
    const inserted =
      await tx.$executeRaw`INSERT INTO "StoreSettings"(id) VALUES(1) ON CONFLICT DO NOTHING`;
    await tx.$queryRaw`SELECT id FROM "StoreSettings" WHERE id=1 FOR UPDATE`;
    await reauthorize(tx, actor, "staff:manage");
    const owner = await tx.userRole.findFirst({
      where: { userId: actor.user.id, role: { key: "OWNER" } },
    });
    if (!owner)
      throw new ApiError(403, "OWNER_REQUIRED", "فقط مدیر کل مجاز است.");
    const old = await tx.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    if (input.version !== (inserted ? 0 : old.version))
      throw new ApiError(
        409,
        "STALE_VERSION",
        "تنظیمات تغییر کرده؛ دوباره بخوانید.",
      );
    const { version, botToken, webhookSecret, ...publicValues } = input;
    void version;
    const token =
      botToken === undefined
        ? old.botTokenEncrypted
        : botToken === null
          ? null
          : encrypt(botToken);
    const secret =
      webhookSecret === undefined
        ? old.webhookSecretEncrypted
        : webhookSecret === null
          ? null
          : encrypt(webhookSecret);
    if (
      input.telegramEnabled &&
      (!(token || process.env.TELEGRAM_BOT_TOKEN) ||
        !(secret || process.env.TELEGRAM_WEBHOOK_SECRET))
    )
      throw new ApiError(
        422,
        "TELEGRAM_SETTINGS",
        "توکن جدید ربات و secret مستقل webhook لازم است.",
      );
    await tx.storeSettings.update({
      where: { id: 1 },
      data: {
        ...publicValues,
        botTokenEncrypted: token,
        webhookSecretEncrypted: secret,
        version: { increment: 1 },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.user.id,
        action: "settings:update",
        resourceId: "store",
        data: {
          telegramEnabled: input.telegramEnabled,
          cardEnabled: input.cardEnabled,
          credentialsChanged:
            botToken !== undefined || webhookSecret !== undefined,
        },
      },
    });
    return { saved: true };
  });
}
export async function telegramAvailable() {
  const c = await integrationConfig();
  return !!(c.enabled && c.token && c.secret);
}
