import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local", quiet: true });
const target = new URL(process.env.TEST_DATABASE_URL || "postgresql://invalid");
if (
  target.pathname !== "/kiya_test" ||
  !["127.0.0.1", "localhost"].includes(target.hostname)
)
  throw new Error("Refusing anything except a local kiya_test database");
const admin = new URL(target);
admin.pathname = "/postgres";
const client = new Client({ connectionString: admin.toString() });
await client.connect();
try {
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    ["kiya_test"],
  );
  if (!result.rowCount) await client.query("CREATE DATABASE kiya_test");
  console.log("Isolated local test database ready.");
} finally {
  await client.end();
}
