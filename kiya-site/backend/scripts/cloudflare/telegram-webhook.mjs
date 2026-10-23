import { Client } from "pg";
import {
  telegramConfiguration,
  telegramCall,
} from "../../cloudflare/telegram.mjs";
const base = process.env.CF_PREVIEW_URL;
if (
  !/^https:\/\/kiya-rebuild-preview\.[a-z0-9-]+\.workers\.dev$/.test(base || "")
)
  throw new Error("Exact deployed preview URL required");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  const config = await telegramConfiguration(client, process.env);
  if (!config || !/^[A-Za-z0-9_-]{32,256}$/.test(config.secret))
    throw new Error("Private Telegram configuration missing or invalid");
  const me = await telegramCall(config.token, "getMe", {});
  if (me?.username?.toLowerCase() !== config.username.toLowerCase())
    throw new Error("Telegram bot identity mismatch");
  const url = base + "/api/webhooks/telegram";
  await telegramCall(config.token, "setWebhook", {
    url,
    secret_token: config.secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  const info = await telegramCall(config.token, "getWebhookInfo", {});
  if (info?.url !== url) throw new Error("Telegram webhook not confirmed");
  console.log(
    "Real Telegram bot identity and deployed webhook registration verified. A real Start/OTP login still needs end-to-end verification.",
  );
} catch {
  throw new Error(
    "Telegram webhook activation failed; no credentials or provider payload logged",
  );
} finally {
  await client.end();
}
