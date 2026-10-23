import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/kiya_test")
  throw new Error(
    "Backend tests require the isolated kiya_test PostgreSQL database; production URLs are refused.",
  );
process.env.DATABASE_URL = url;
process.env.APP_MODE = "demo";
process.env.ALLOW_DEMO_LOGIN = "true";

process.env.MEDIA_ROOT = process.cwd() + "/.data/test-media";

// Real installation identity allowlists must never influence isolated synthetic tests.
for (const key of [
  "KIYA_BOOTSTRAP_OWNER_PHONE",
  "KIYA_BOOTSTRAP_OWNER_PHONES",
  "KIYA_BOOTSTRAP_OWNER_TELEGRAM_ID",
])
  delete process.env[key];

for (const key of [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_LOGIN_ENABLED",
])
  delete process.env[key];
