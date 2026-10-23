import { config } from "dotenv";
import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
config({ path: ".env.local", quiet: true });
const url = process.argv.includes("--test")
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;
if (!url) throw new Error("Database URL is not configured");
if (
  process.argv.includes("--test") &&
  !new URL(url).pathname.endsWith("/kiya_test")
)
  throw new Error("Refusing non-test database");
const client = new Client({ connectionString: url });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(27102026)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS kiya_schema_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  for (const folder of readdirSync("prisma/migrations")
    .filter((n) => /^\d/.test(n))
    .sort()) {
    const sql = readFileSync(
      `prisma/migrations/${folder}/migration.sql`,
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT checksum FROM kiya_schema_migrations WHERE name=$1",
      [folder],
    );
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error("Applied migration checksum mismatch");
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO kiya_schema_migrations(name,checksum) VALUES($1,$2)",
        [folder, checksum],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    console.log("Applied migration", folder);
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(27102026)");
  await client.end();
}
