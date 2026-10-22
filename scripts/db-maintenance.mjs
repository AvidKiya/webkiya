import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local", quiet: true });
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const buckets = await client.query(
    'DELETE FROM "RateBucket" WHERE "expiresAt" < now()',
  );
  const sessions = await client.query(
    'DELETE FROM "Session" WHERE "expiresAt" < now() - interval \'30 days\'',
  );
  await client.query("COMMIT");
  console.log(
    "Expired rate buckets removed:",
    buckets.rowCount,
    "Old expired sessions removed:",
    sessions.rowCount,
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
