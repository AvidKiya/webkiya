// Trusted host operator only; no HTTP endpoint, no role grants, no token-bearing logs.
import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local", quiet: true });
try {
  if (
    process.argv.length !== 3 ||
    !["--poll", "--webhook"].includes(process.argv[2])
  )
    throw Error();
  const token = process.env.TELEGRAM_BOT_TOKEN,
    secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    !token ||
    !secret ||
    !/^[-A-Za-z0-9_]{32,256}$/.test(secret) ||
    process.env.TELEGRAM_LOGIN_ENABLED !== "true"
  )
    throw Error();
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    if ((await db.query('SELECT id FROM "StoreSettings" WHERE id=1')).rowCount)
      throw Error();
  } finally {
    await db.end();
  }
  async function call(method, body) {
    const r = await fetch(
      "https://api.telegram.org/bot" + token + "/" + method,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    );
    const data = await r.json();
    if (!r.ok || !data.ok) throw Error();
    return data.result;
  }
  const me = await call("getMe", {});
  if (me.username?.toLowerCase() !== "kiyaco24bot") throw Error();
  if (process.argv[2] === "--poll")
    await call("deleteWebhook", { drop_pending_updates: false });
  else {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || "");
    if (site.protocol !== "https:" || site.username || site.password)
      throw Error();
    await call("setWebhook", {
      url: new URL("/api/webhooks/telegram", site).href,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
  }
  console.log(
    "First-install Telegram identity verified and delivery mode configured. Run the matching transport worker and test the complete browser login; this does not grant ownership or prove message delivery.",
  );
} catch {
  console.error(
    "First-install setup failed. Requires trusted host env with fresh credentials, no StoreSettings row, correct bot identity and provider access. For an existing installation use OWNER/MFA settings. No credentials were logged.",
  );
  process.exitCode = 1;
}
