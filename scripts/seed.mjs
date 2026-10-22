import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env.local", quiet: true });
const client = new Client({
  connectionString: process.argv.includes("--test")
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL,
});
await client.connect();
const owner = [
  "dashboard:read",
  "comment:read",
  "comment:reply",
  "comment:moderate",
  "partner:read",
  "partner:review",
  "partner:approve",
  "partner:suspend",
  "product:read",
  "product:write",
  "staff:read",
  "staff:manage",
  "role:manage",
  "audit:read",
];
const support = [
  "dashboard:read",
  "comment:read",
  "comment:reply",
  "comment:moderate",
  "partner:read",
  "partner:review",
  "partner:approve",
  "partner:suspend",
];
try {
  await client.query("BEGIN");
  for (const [key, name, perms] of [
    ["OWNER", "مالک فروشگاه", owner],
    ["SUPPORT", "پشتیبان", support],
    [
      "CONTENT",
      "مدیر محتوا",
      ["dashboard:read", "comment:read", "product:read"],
    ],
  ])
    await client.query(
      'INSERT INTO "Role" ("key","name","permissions") VALUES($1,$2,$3) ON CONFLICT ("key") DO NOTHING',
      [key, name, perms],
    );
  for (const [id, name, price] of [
    ["everyday-bag", "کیف دستی و دوشی چرم", "1450000"],
    ["minimal-watch", "ساعت مچی با بند چرمی", "2290000"],
    ["leather-wallet", "کیف پول و جاکلیدی ست", "380000"],
    ["daily-glasses", "عینک آفتابی فریم کلاسیک", "640000"],
    ["little-light", "چراغ دکوری کوچک", "1150000"],
  ])
    await client.query(
      'INSERT INTO "Product" ("id","name","price","status") VALUES($1,$2,$3,\'PUBLISHED\') ON CONFLICT ("id") DO NOTHING',
      [id, name, price],
    );
  await client.query("COMMIT");
  console.log(
    "Demo products and baseline roles seeded; no owner password or user PII seeded.",
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
