import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local", quiet: true });
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  // Autocommit one order at a time: no SKU locks are held across orders.
  const due = await client.query(
    'SELECT id FROM "PurchaseOrder" WHERE status=\'RESERVED\' AND "reservedUntil"<=clock_timestamp() ORDER BY "reservedUntil",id LIMIT 100',
  );
  for (const o of due.rows)
    await client.query("SELECT kiya_release_order($1::uuid,'EXPIRED',NULL)", [
      o.id,
    ]);
  console.log("Expired reservations checked:", due.rowCount);
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
