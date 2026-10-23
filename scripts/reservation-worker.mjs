import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error("Database URL is not configured");
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let stopping = false;
let wake;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    wake?.();
  });
try {
  do {
    try {
      const due = await client.query(
        'SELECT id FROM "PurchaseOrder" WHERE status=\'RESERVED\' AND "reservedUntil"<=clock_timestamp() ORDER BY "reservedUntil",id LIMIT 100',
      );
      let released = 0;
      for (const row of due.rows) {
        if (stopping) break;
        const result = await client.query(
          "SELECT kiya_release_order($1::uuid,'EXPIRED',NULL) AS released",
          [row.id],
        );
        if (result.rows[0].released) released++;
      }
      if (released) console.log("Expired reservations released:", released);
    } catch (error) {
      console.error("Reservation maintenance failed", {
        type: error instanceof Error ? error.name : "Unknown",
      });
      if (process.argv.includes("--once"))
        throw new Error("Reservation maintenance failed");
    }
    if (process.argv.includes("--once") || stopping) break;
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        wake = undefined;
        resolve();
      }, 10000);
      wake = () => {
        clearTimeout(timer);
        wake = undefined;
        resolve();
      };
    });
  } while (!stopping);
} finally {
  await client.end();
}
