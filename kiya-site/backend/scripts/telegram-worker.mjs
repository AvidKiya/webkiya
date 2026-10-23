// Durable Telegram transport. No credentials, URLs containing tokens, messages or user IDs are logged.
import { config } from "dotenv";
import { Client } from "pg";
import { createDecipheriv } from "node:crypto";
config({ path: ".env.local", quiet: true });
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
let stopping = false;
for (const s of ["SIGINT", "SIGTERM"])
  process.on(s, () => {
    stopping = true;
  });
const decrypt = (encoded) => {
  const [iv, tag, data] = encoded.split(".");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.MFA_ENCRYPTION_KEY || "", "hex"),
    Buffer.from(iv, "hex"),
  );
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    cipher.update(Buffer.from(data, "hex")),
    cipher.final(),
  ]).toString("utf8");
};
async function configuration() {
  const r = (await db.query('SELECT * FROM "StoreSettings" WHERE id=1'))
    .rows[0];
  if (!(r?.telegramEnabled ?? process.env.TELEGRAM_LOGIN_ENABLED === "true"))
    return null;
  const token = r.botTokenEncrypted
      ? decrypt(r.botTokenEncrypted)
      : process.env.TELEGRAM_BOT_TOKEN,
    secret = r.webhookSecretEncrypted
      ? decrypt(r.webhookSecretEncrypted)
      : process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) return null;
  return { token, secret };
}
async function call(token, method, body) {
  let result;
  try {
    const r = await fetch(
      "https://api.telegram.org/bot" + token + "/" + method,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(35000),
      },
    );
    result = await r.json();
  } catch {
    throw new Error("TELEGRAM_TRANSPORT_UNAVAILABLE");
  }
  if (!result.ok) {
    const error = new Error("TELEGRAM_PROVIDER_REJECTED");
    if (result.error_code === 429)
      error.retryAfter = Math.min(
        3600,
        Math.max(1, Number(result.parameters?.retry_after) || 30),
      );
    throw error;
  }
  return result.result;
}
const origin = process.env.TELEGRAM_INTERNAL_ORIGIN || "http://127.0.0.1:3101";
const url = new URL(origin);
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  url.protocol !== "http:"
)
  throw new Error("TELEGRAM_INTERNAL_ORIGIN must be the loopback app origin");
try {
  const lock = await db.query(
    "SELECT pg_try_advisory_lock(27102039) AS locked",
  );
  if (!lock.rows[0].locked)
    throw new Error("Only one Telegram transport worker is allowed.");
  await db.query(
    `UPDATE "TelegramOutbox" SET state='UNKNOWN' WHERE state='SENDING'`,
  );
  console.log(
    "Telegram transport running; provider connectivity is not verified. Waiting for enabled settings if unconfigured.",
  );
  while (!stopping) {
    try {
      await db.query(
        `DELETE FROM "TelegramLogin" WHERE "expiresAt"<now()-interval '1 day'`,
      );
      await db.query(
        `DELETE FROM "TelegramOutbox" WHERE "createdAt"<now()-interval '1 day' AND state IN ('SENT','UNKNOWN')`,
      );
      await db.query(
        `DELETE FROM "TelegramUpdate" WHERE "createdAt"<now()-interval '6 days'`,
      );
      await db.query(
        `UPDATE "TelegramOutbox" SET state='UNKNOWN' WHERE state='PENDING' AND "createdAt"<now()-interval '3 minutes'`,
      );
      const c = await configuration();
      if (!c) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (process.argv.includes("--poll")) {
        const row = (
          await db.query('SELECT max(id)::text AS last FROM "TelegramUpdate"')
        ).rows[0];
        const updates = await call(c.token, "getUpdates", {
          offset: row.last ? Number(row.last) + 1 : 0,
          timeout: 1,
          allowed_updates: ["message", "callback_query"],
        });
        for (const update of updates) {
          const result = await fetch(origin + "/api/webhooks/telegram", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-telegram-bot-api-secret-token": c.secret,
            },
            body: JSON.stringify(update),
            signal: AbortSignal.timeout(10000),
          });
          if (
            [413, 422].includes(result.status) &&
            Number.isSafeInteger(update.update_id)
          ) {
            await db.query(
              'INSERT INTO "TelegramUpdate"(id) VALUES($1) ON CONFLICT DO NOTHING',
              [update.update_id],
            );
            continue;
          }
          if (!result.ok) throw new Error("TELEGRAM_LOCAL_HANDLER_UNAVAILABLE");
        }
      }
      for (let i = 0; i < 20; i++) {
        const item = (
          await db.query(
            `UPDATE "TelegramOutbox" SET state='SENDING' WHERE id=(SELECT id FROM "TelegramOutbox" WHERE state='PENDING' ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
          )
        ).rows[0];
        if (!item) break;
        try {
          await call(c.token, "sendMessage", {
            chat_id: item.chatId,
            text: item.text,
            ...(item.requestContact
              ? {
                  reply_markup: {
                    keyboard: [
                      [{ text: "اشتراک شمارهٔ خودم", request_contact: true }],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                  },
                }
              : {}),
            ...(item.callback
              ? {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "خودم درخواست داده‌ام؛ تأیید ورود",
                          callback_data: item.callback,
                        },
                      ],
                    ],
                  },
                }
              : {}),
          });
          await db.query(
            `UPDATE "TelegramOutbox" SET state='SENT' WHERE id=$1`,
            [item.id],
          );
        } catch (error) {
          if (error.retryAfter) {
            await db.query(
              `UPDATE "TelegramOutbox" SET state='PENDING' WHERE id=$1`,
              [item.id],
            );
            await new Promise((r) => setTimeout(r, error.retryAfter * 1000));
            break;
          }
          await db.query(
            `UPDATE "TelegramOutbox" SET state='UNKNOWN' WHERE id=$1`,
            [item.id],
          );
          console.error(
            "Telegram message result unknown; not blindly retried. User may request a new login.",
          );
        }
      }
    } catch (error) {
      if (error.retryAfter) {
        await new Promise((r) => setTimeout(r, error.retryAfter * 1000));
        continue;
      }
      console.error(
        "Telegram worker unavailable; check configuration and provider connectivity.",
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
} finally {
  await db.end();
}
