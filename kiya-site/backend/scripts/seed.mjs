import { config } from "dotenv";
import { Client } from "pg";
import { readFileSync } from "node:fs";
const fixtures = JSON.parse(
  readFileSync("src/lib/catalog-fixtures.json", "utf8"),
);
config({ path: ".env.local", quiet: true });
const client = new Client({
  connectionString: process.argv.includes("--test")
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL,
});
await client.connect();
const owner = [
  "payment:review",
  "order:read",
  "order:manage",
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
  "product:publish",
  "inventory:read",
  "inventory:manage",
  "wholesale:pack:manage",
  "wholesale:pack:publish",
  "wholesale:price:read",
  "wholesale:price:manage",
  "wholesale:price:publish",
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
  for (const [order, p] of fixtures.entries()) {
    await client.query(
      'UPDATE "Product" SET subtitle=$2,category=$3,description=$4,"imagePath"=$5,"packSize"=$6,tag=$7,collection=$8,"previousPrice"=$9,"isDemo"=true,"sortOrder"=$10 WHERE id=$1 AND "imagePath"=\'\' AND category=\'\'',
      [
        p.id,
        p.subtitle,
        p.category,
        p.description,
        p.image,
        p.packSize,
        p.tag,
        p.collection,
        p.previous || null,
        order,
      ],
    );
    const count = await client.query(
      'SELECT 1 FROM "ProductVariant" WHERE "productId"=$1 LIMIT 1',
      [p.id],
    );
    const demo = await client.query(
      'SELECT 1 FROM "Product" WHERE id=$1 AND "isDemo"=true',
      [p.id],
    );
    if (!count.rowCount && demo.rowCount)
      for (const [i, color] of p.colors.entries())
        await client.query(
          'INSERT INTO "ProductVariant"("productId",sku,name,hex) VALUES($1,$2,$3,$4)',
          [
            p.id,
            ("DEMO-" + p.id + "-" + i).toUpperCase(),
            color.name,
            color.hex,
          ],
        );
  }
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
