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
