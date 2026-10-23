// Finite, webhook-driven transport. Never log tokens, URLs, message text or IDs.
import { createDecipheriv } from "node:crypto";
export function decryptTelegram(value, key) {
  if (!/^[a-f0-9]{64}$/i.test(key || ""))
    throw new Error("TELEGRAM_KEY_UNCONFIGURED");
  const [iv, tag, body] = value.split(".");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex"),
  );
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    cipher.update(Buffer.from(body, "hex")),
    cipher.final(),
  ]).toString("utf8");
}
export async function telegramConfiguration(client, env) {
  const row = (await client.query('SELECT * FROM "StoreSettings" WHERE id=1'))
    .rows[0];
  if (!(row?.telegramEnabled ?? env.TELEGRAM_LOGIN_ENABLED === "true"))
    return null;
  const token = row?.botTokenEncrypted
    ? decryptTelegram(row.botTokenEncrypted, env.MFA_ENCRYPTION_KEY)
    : env.TELEGRAM_BOT_TOKEN;
  const secret = row?.webhookSecretEncrypted
    ? decryptTelegram(row.webhookSecretEncrypted, env.MFA_ENCRYPTION_KEY)
    : env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) return null;
  return { token, secret, username: row?.botUsername || "kiyaco24bot" };
}
export async function telegramCall(token, method, body, transport = fetch) {
  try {
    const response = await transport(
      "https://api.telegram.org/bot" + token + "/" + method,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      },
    );
    const value = await response.json();
    if (!response.ok || !value.ok) throw new Error("PROVIDER_REJECTED");
    return value.result;
  } catch {
    throw new Error("TELEGRAM_PROVIDER_UNAVAILABLE");
  }
}
export async function drainTelegram(client, env, transport = fetch) {
  const lock = await client.query(
    "SELECT pg_try_advisory_lock(27102039) AS locked",
  );
  if (!lock.rows[0].locked) return { sent: 0, busy: true };
  let sent = 0;
  try {
    // No blindly repeated delivery after a previous request crashed mid-send.
    await client.query(
      `UPDATE "TelegramOutbox" SET state='UNKNOWN' WHERE state IN ('SENDING','PENDING') AND "createdAt"<now()-interval '3 minutes'`,
    );
    const config = await telegramConfiguration(client, env);
    if (!config) return { sent };
    const pending = await client.query(
      `SELECT id FROM "TelegramOutbox" WHERE state='PENDING' LIMIT 1`,
    );
    if (!pending.rows.length) return { sent };
    const deadline = Date.now() + 18000;
    const me = await telegramCall(config.token, "getMe", {}, transport);
    if (me?.username?.toLowerCase() !== config.username.toLowerCase())
      throw new Error("TELEGRAM_BOT_MISMATCH");
    for (let i = 0; i < 20 && Date.now() < deadline; i++) {
      const item = (
        await client.query(
          `UPDATE "TelegramOutbox" SET state='SENDING' WHERE id=(SELECT id FROM "TelegramOutbox" WHERE state='PENDING' ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
        )
      ).rows[0];
      if (!item) break;
      try {
        const text = item.text.startsWith("otp-encrypted:")
          ? decryptTelegram(item.text.slice(14), env.MFA_ENCRYPTION_KEY)
          : item.text;
        const markup = item.requestContact
          ? {
              keyboard: [
                [{ text: "اشتراک شمارهٔ خودم", request_contact: true }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            }
          : item.callback
            ? {
                inline_keyboard: [
                  [
                    {
                      text: "خودم درخواست داده‌ام؛ تأیید ورود",
                      callback_data: item.callback,
                    },
                  ],
                ],
              }
            : null;
        await telegramCall(
          config.token,
          "sendMessage",
          {
            chat_id: String(item.chatId),
            text,
            ...(markup ? { reply_markup: markup } : {}),
          },
          transport,
        );
        await client.query(
          `UPDATE "TelegramOutbox" SET state='SENT' WHERE id=$1`,
          [item.id],
        );
        sent++;
      } catch {
        // Includes 429: no sleeping in Workers, retry storms or unknown-result replay.
        await client.query(
          `UPDATE "TelegramOutbox" SET state='UNKNOWN' WHERE id=$1`,
          [item.id],
        );
        throw new Error("TELEGRAM_DELIVERY_UNCONFIRMED");
      }
    }
    return { sent };
  } finally {
    await client.query("SELECT pg_advisory_unlock(27102039)");
  }
}
