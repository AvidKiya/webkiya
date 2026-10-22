import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { randomBytes, scryptSync, createHmac } from "node:crypto";
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  return ((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
test("customer partnership request persists through a reload", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "ورود آزمایشی", exact: true }).click();
  await page.getByLabel("نام فروشگاه یا کسب‌وکار").fill("فروشگاه آزمایشی");
  await page.getByLabel("شهر", { exact: true }).fill("تهران");
  await page.getByLabel("توضیح درخواست").fill("درخواست آزمایشی خرید از یک جین");
  await page
    .getByRole("button", { name: "ثبت درخواست همکاری", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "وضعیت: در انتظار بررسی" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "وضعیت: در انتظار بررسی" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ورود آزمایشی", exact: true }),
  ).toBeVisible();
});
test("staff password, TOTP setup, recovery, scoped navigation and logout", async ({
  page,
}) => {
  if (process.env.APP_MODE !== "demo" || !process.env.DATABASE_URL)
    throw new Error(
      "Browser staff fixture is allowed only in the explicit local demo environment",
    );
  const url = new URL(process.env.DATABASE_URL);
  if (
    !["/kiya_dev", "/kiya_test"].includes(url.pathname) ||
    !["127.0.0.1", "localhost"].includes(url.hostname)
  )
    throw new Error(
      "Refusing to provision a staff fixture on a remote/live database",
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const handle = "e2e_" + randomBytes(6).toString("hex"),
    password = randomBytes(24).toString("hex"),
    salt = randomBytes(16).toString("hex");
  let userId: string | undefined;
  try {
    const result = await client.query(
      'INSERT INTO "User"(kind,"displayName",handle,"passwordHash","isDemo") VALUES(\'STAFF\',\'مدیر محتوای آزمون\',$1,$2,true) RETURNING id',
      [
        handle,
        salt +
          ":" +
          scryptSync(password, salt, 64, {
            N: 32768,
            maxmem: 64 * 1024 * 1024,
          }).toString("hex"),
      ],
    );
    userId = result.rows[0].id;
    await client.query(
      'INSERT INTO "UserRole"("userId","roleId") SELECT $1,id FROM "Role" WHERE key=\'CONTENT\'',
      [userId],
    );
    await client.query(
      `INSERT INTO "Role"(key,name,permissions) VALUES($1,'نقش موقت آزمون کالا',ARRAY['product:write'])`,
      [handle],
    );
    await client.query(
      'INSERT INTO "UserRole"("userId","roleId") SELECT $1,id FROM "Role" WHERE key=$2',
      [userId, handle],
    );
    await page.goto("/admin");
    await page.getByLabel("شناسهٔ پرسنلی").fill(handle);
    await page.getByLabel("رمز عبور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "ادامهٔ ورود امن" }).click();
    await expect(
      page.getByRole("button", { name: "تنظیم تأیید دومرحله‌ای" }),
    ).toBeVisible();
    expect((await page.request.get("/api/admin/dashboard")).status()).toBe(403);
    await page.getByRole("button", { name: "تنظیم تأیید دومرحله‌ای" }).click();
    const secret = await page.locator(".admin-secret").textContent();
    expect(secret).toBeTruthy();
    await page.getByLabel("کد تأیید یا بازیابی").fill(totp(secret!));
    await page.getByRole("button", { name: "تأیید و ورود به مدیریت" }).click();
    await expect(page.locator(".recovery-list code")).toHaveCount(8);
    await page.getByRole("button", { name: "کدها را امن ذخیره کردم" }).click();
    await expect(
      page.getByRole("heading", { name: "نمای کلی", exact: true }),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "ناوبری مدیریت" });
    await expect(
      nav.getByRole("button", { name: "کاتالوگ", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("button", { name: "پروندهٔ همکاران", exact: true }),
    ).toHaveCount(0);
    expect((await page.request.get("/api/admin/staff")).status()).toBe(403);
    await nav.getByRole("button", { name: "کاتالوگ", exact: true }).click();
    await expect(page.locator(".admin-record")).toHaveCount(5);
    const draftName = "کالای آزمون " + handle;
    const createForm = page.locator(".admin-product-form").first();
    await createForm.getByLabel("نام کالا", { exact: true }).fill(draftName);
    await createForm
      .getByLabel("قیمت پایهٔ پیش‌نویس (تومان، فقط رقم انگلیسی)")
      .fill("123000");
    await createForm
      .getByRole("button", { name: "ثبت پیش‌نویس", exact: true })
      .click();
    const record = page.locator(".admin-record").filter({
      has: page.getByRole("heading", { name: draftName, exact: true }),
    });
    await expect(record).toBeVisible();
    await record
      .getByLabel("قیمت پایهٔ پیش‌نویس (تومان، فقط رقم انگلیسی)")
      .fill("234000");
    await record
      .getByRole("button", { name: "ذخیره تغییرات پیش‌نویس", exact: true })
      .click();
    await expect(
      record.getByText("۲۳۴٬۰۰۰ تومان · قیمت پایهٔ پیش‌نویس", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await nav.getByRole("button", { name: "کاتالوگ", exact: true }).click();
    await expect(
      record.getByText("۲۳۴٬۰۰۰ تومان · قیمت پایهٔ پیش‌نویس", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "خروج امن", exact: true }).click();
    await expect(page.getByLabel("شناسهٔ پرسنلی")).toBeVisible();
    expect((await page.request.get("/api/admin/dashboard")).status()).toBe(401);
  } finally {
    await client.query(
      `DELETE FROM "Product" WHERE status='DRAFT' AND name=$1`,
      ["کالای آزمون " + handle],
    );
    if (userId) await client.query('DELETE FROM "User" WHERE id=$1', [userId]);
    await client.query('DELETE FROM "Role" WHERE key=$1', [handle]);
    await client.end();
  }
});

test("read-only admin preview is browsable without authenticating or calling private APIs", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) calls.push(r.url());
  });
  await page.goto("/");
  await page
    .getByRole("link", { name: "نمایش مدیریت (فقط خواندنی)", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "نمایش فقط خواندنی" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "ناوبری مدیریت" });
  await expect(nav.getByRole("button")).toHaveCount(6);
  for (const name of [
    "گفت‌وگوها",
    "پروندهٔ همکاران",
    "کاتالوگ",
    "تیم و دسترسی‌ها",
    "رویدادهای امنیتی",
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ثبت تصمیم", exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "ثبت پیش‌نویس", exact: true }),
  ).toHaveCount(0);
  expect(calls).toEqual([]);
  expect((await page.request.get("/api/admin/dashboard")).status()).toBe(401);
  const me = await (await page.request.get("/api/auth/me")).json();
  expect(me.data.user).toBeNull();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("real owner console creates staff and roles, revokes access, and rotates own password", async ({
  page,
  browser,
}) => {
  if (process.env.APP_MODE !== "demo" || !process.env.DATABASE_URL)
    throw new Error("Local demo fixture only");
  const url = new URL(process.env.DATABASE_URL);
  if (
    !["/kiya_dev", "/kiya_test"].includes(url.pathname) ||
    !["127.0.0.1", "localhost"].includes(url.hostname)
  )
    throw new Error("Remote DB refused");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const suffix = randomBytes(6).toString("hex"),
    handle = "iam_" + suffix,
    staffHandle = "member_" + suffix,
    roleName = "نقش آزمون " + suffix,
    staffName = "پرسنل آزمون " + suffix;
  const password = randomBytes(24).toString("hex"),
    newPassword = randomBytes(24).toString("hex"),
    staffPassword = randomBytes(24).toString("hex"),
    salt = randomBytes(16).toString("hex");
  let ownerId: string | undefined;
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
  const member = await browser.newContext({ baseURL: base });
  try {
    const u = await client.query(
      'INSERT INTO "User"(kind,"displayName",handle,"passwordHash","isDemo") VALUES(\'STAFF\',\'مدیر کل موقت آزمون\',$1,$2,true) RETURNING id',
      [
        handle,
        salt +
          ":" +
          scryptSync(password, salt, 64, {
            N: 32768,
            maxmem: 64 * 1024 * 1024,
          }).toString("hex"),
      ],
    );
    ownerId = u.rows[0].id;
    await client.query(
      'INSERT INTO "UserRole"("userId","roleId") SELECT $1,id FROM "Role" WHERE key=\'OWNER\'',
      [ownerId],
    );
    await page.goto("/admin");
    await page.getByLabel("شناسهٔ پرسنلی").fill(handle);
    await page.getByLabel("رمز عبور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "ادامهٔ ورود امن" }).click();
    await page.getByRole("button", { name: "تنظیم تأیید دومرحله‌ای" }).click();
    const secret = await page.locator(".admin-secret").textContent();
    await page.getByLabel("کد تأیید یا بازیابی").fill(totp(secret!));
    await page.getByRole("button", { name: "تأیید و ورود به مدیریت" }).click();
    await page.getByRole("button", { name: "کدها را امن ذخیره کردم" }).click();
    await page
      .getByRole("navigation", { name: "ناوبری مدیریت" })
      .getByRole("button", { name: "تیم و دسترسی‌ها", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "مدیر کل · پرسنل و نقش‌های واقعی" }),
    ).toBeVisible();
    const roleCreate = page.getByTestId("role-create");
    await roleCreate.locator("summary").click();
    await roleCreate.getByLabel("نام نقش", { exact: true }).fill(roleName);
    await roleCreate.getByLabel("نمای کلی", { exact: true }).check();
    await roleCreate.getByLabel("خواندن کالا", { exact: true }).check();
    await roleCreate
      .getByRole("button", { name: "ساخت نقش سفارشی", exact: true })
      .click();
    const staffCreate = page.getByTestId("staff-create");
    await staffCreate.locator("summary").click();
    await staffCreate.getByLabel("نام نمایشی پرسنل").fill(staffName);
    await staffCreate
      .getByLabel("شناسهٔ ورود (انگلیسی، شروع با حرف)")
      .fill(staffHandle);
    await staffCreate
      .getByLabel("رمز اولیهٔ پرسنل (حداقل ۱۴ نویسه)")
      .fill(staffPassword);
    await staffCreate.getByLabel(roleName, { exact: true }).check();
    await staffCreate
      .getByRole("button", { name: "ساخت حساب واقعی پرسنل" })
      .click();
    const record = page
      .locator(".access-record")
      .filter({
        has: page.getByRole("heading", { name: staffName, exact: true }),
      });
    await expect(record).toBeVisible();
    const login = await member.request.post("/api/auth/staff", {
      headers: { Origin: base },
      data: { handle: staffHandle, password: staffPassword },
    });
    expect(login.status()).toBe(200);
    expect((await member.request.get("/api/admin/access")).status()).toBe(403);
    const roleEdit = page
      .locator("details.access-section")
      .filter({ has: page.locator("summary").filter({ hasText: roleName }) });
    await roleEdit.locator("summary").click();
    await roleEdit.getByLabel("خواندن کالا", { exact: true }).uncheck();
    await roleEdit
      .getByRole("button", { name: "ذخیره نقش و ابطال نشست‌های مربوط" })
      .click();
    await expect
      .poll(
        async () =>
          (await (await member.request.get("/api/auth/me")).json()).data.user,
      )
      .toBeNull();
    await record.locator("summary").click();
    await record.getByLabel("حساب فعال باشد").uncheck();
    await record
      .getByLabel("دلیل تغییر", { exact: true })
      .fill("پایان دسترسی حساب آزمون");
    await record.getByRole("button", { name: "ثبت وضعیت و نقش‌ها" }).click();
    await expect(record.getByText(/غیرفعال/)).toBeVisible();
    const security = page
      .locator("details")
      .filter({
        has: page
          .locator("summary")
          .getByText("امنیت حساب من · تغییر رمز", { exact: true }),
      });
    await security.locator("summary").click();
    await security.getByLabel("رمز فعلی", { exact: true }).fill(password);
    await security.getByLabel("رمز جدید", { exact: true }).fill(newPassword);
    await security
      .getByLabel("تکرار رمز جدید", { exact: true })
      .fill(newPassword);
    await security
      .getByRole("button", { name: "تغییر رمز و خروج از همهٔ نشست‌ها" })
      .click();
    await expect(page.getByLabel("شناسهٔ پرسنلی")).toBeVisible();
    const response = await page.request.post("/api/auth/staff", {
      headers: { Origin: base },
      data: { handle, password: newPassword },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.mfaRequired).toBe(true);
  } finally {
    await member.close();
    await client.query('DELETE FROM "User" WHERE handle=$1', [staffHandle]);
    if (ownerId)
      await client.query('DELETE FROM "User" WHERE id=$1', [ownerId]);
    await client.query(
      "DELETE FROM \"Role\" WHERE name=$1 AND key LIKE 'CUSTOM_%'",
      [roleName],
    );
    await client.end();
  }
});
