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
    const record = page.locator(".access-record").filter({
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
    const security = page.locator("details").filter({
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

test("owner manages a real photo, SKU, stock and public catalog lifecycle", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
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
    handle = "catalog_" + suffix,
    password = randomBytes(24).toString("hex"),
    salt = randomBytes(16).toString("hex"),
    name = "کیف آزمون مرورگر " + suffix;
  let ownerId: string | undefined,
    productId: string | undefined,
    mediaId: string | undefined,
    reviewerId: string | undefined,
    buyerId: string | undefined;
  const reviewerContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3000",
    }),
    buyerContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3000",
    });
  try {
    const actor = await client.query(
      'INSERT INTO "User"(kind,"displayName",handle,"passwordHash","isDemo") VALUES(\'STAFF\',\'مدیر موقت کاتالوگ\',$1,$2,true) RETURNING id',
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
    ownerId = actor.rows[0].id;
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
      .getByRole("button", { name: "کاتالوگ", exact: true })
      .click();
    const create = page.locator("form.admin-product-form").first();
    await create.getByLabel("نام کالا", { exact: true }).fill(name);
    await create
      .getByLabel("قیمت پایهٔ پیش‌نویس (تومان، فقط رقم انگلیسی)")
      .fill("250000");
    await create
      .getByRole("button", { name: "ثبت پیش‌نویس", exact: true })
      .click();
    const record = page
      .locator("article.admin-record")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(record).toBeVisible();
    productId = (
      await client.query(
        'SELECT p.id FROM "Product" p JOIN "AuditLog" a ON a."resourceId"=p.id WHERE a."actorId"=$1 AND a.action=\'product:draft_create\'',
        [ownerId],
      )
    ).rows[0].id;
    expect((await page.request.get("/p/" + productId)).status()).toBe(404);
    const editor = record.locator("details.product-workbench");
    await editor.locator("summary").first().click();
    await expect(editor.getByLabel("نام اصلی کالا")).toBeVisible();
    await editor
      .getByLabel("عنوان کوتاه برای پست")
      .fill("کیف کوچک واقعی آزمون");
    await editor.getByLabel("دستهٔ کالا").selectOption("کیف و کیف پول");
    await editor
      .getByLabel("توضیحات کالا")
      .fill("توضیحات کافی و دقیق برای آزمون ثبت کالای واقعی در پنل.");
    await editor.getByLabel("تعداد واحد داخل بسته").fill("6");
    const sharp = (await import("sharp")).default;
    const image = await sharp({
      create: {
        width: 360,
        height: 360,
        channels: 3,
        background: "#" + suffix.slice(0, 6),
      },
    })
      .png()
      .toBuffer();
    await editor.getByLabel("تصویر اصلی کالا").setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: image,
    });
    await expect(
      editor.getByText(
        "تصویر آماده شد؛ برای اتصال به کالا، مشخصات را ذخیره کنید.",
      ),
    ).toBeVisible();
    mediaId = (
      await client.query('SELECT id FROM "MediaAsset" WHERE "createdBy"=$1', [
        ownerId,
      ])
    ).rows[0].id;
    expect(
      (
        await page.request.get("/api/media/" + mediaId, {
          headers: { Cookie: "" },
        })
      ).status(),
    ).toBe(404);
    await editor
      .getByRole("button", { name: "ذخیره مشخصات کالا", exact: true })
      .click();
    await expect(editor.getByText("تغییرات روی سرور ثبت شد.")).toBeVisible();
    await editor.getByLabel("نام رنگ جدید").fill("بنفش آزمون");
    await editor.getByLabel("کد SKU جدید").fill("BROWSER-" + suffix);
    await editor
      .getByRole("button", { name: "افزودن رنگ با موجودی صفر" })
      .click();
    await expect(editor.locator(".stock-record")).toHaveCount(1);
    const stock = editor.locator(".stock-record");
    await stock.getByLabel("تغییر تعداد (+ ورود / − خروج)").fill("8");
    await stock
      .getByLabel("دلیل اصلاح موجودی")
      .fill("ورود موجودی آزمون مرورگر");
    await stock.getByRole("button", { name: "ثبت اصلاح موجودی" }).click();
    await expect(stock.getByText(/کل: ۸/)).toBeVisible();
    const packs = editor.locator(".pack-manager");
    await packs.locator("details.pack-create>summary").click();
    await packs.getByLabel("نام تعریف جین").fill("جین شش‌تایی آزمون");
    await packs.getByLabel("نوع ترکیب").selectOption("HOMOGENEOUS");
    await packs.getByLabel("تعداد در جین: بنفش آزمون").fill("6");
    await packs
      .getByRole("button", { name: "ذخیره تعریف جین", exact: true })
      .click();
    await expect(packs.locator(".pack-record")).toHaveCount(1);
    await expect(
      packs.locator(".pack-record").getByText(/۶ واحد در هر جین/),
    ).toBeVisible();

    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        "open product editor overflow at " + width,
      ).toBe(true);
    }

    await editor
      .getByLabel("دلیل تغییر وضعیت", { exact: true })
      .fill("تکمیل پرونده برای انتشار آزمون");
    await editor.getByRole("button", { name: "انتشار در ویترین" }).click();
    await expect(
      editor.getByRole("button", { name: "بایگانی کالا", exact: true }),
    ).toBeVisible();
    const packRecord = editor.locator(".pack-record");
    await packRecord.getByLabel("عملیات جین").selectOption("ACTIVE");
    await packRecord
      .getByLabel("دلیل تغییر وضعیت جین")
      .fill("ترکیب جین آزمون تأیید شد");
    await packRecord
      .getByRole("button", { name: "ثبت وضعیت جین", exact: true })
      .click();
    await expect(packRecord.getByRole("heading")).toContainText("فعال");

    const buyerPage = await buyerContext.newPage();
    await buyerPage.goto("/account");
    await buyerPage
      .getByRole("button", { name: "ورود آزمایشی", exact: true })
      .click();
    await expect(
      buyerPage.getByRole("button", { name: "خروج از حساب", exact: true }),
    ).toBeVisible();
    buyerId = (await (await buyerPage.request.get("/api/auth/me")).json()).data
      .user.id;
    const businessName = "همکار قیمت آزمون " + suffix;
    const application = await buyerPage.request.post("/api/partner", {
      headers: { Origin: "http://127.0.0.1:3000" },
      data: { businessName, city: "تهران", note: "درخواست مصنوعی تست قیمت" },
    });
    expect(application.status()).toBe(201);
    const partnerId = (await application.json()).data.id;
    expect(
      (
        await page.request.patch("/api/admin/partners/" + partnerId, {
          headers: { Origin: "http://127.0.0.1:3000" },
          data: {
            status: "APPROVED",
            version: 1,
            reason: "همکار مصنوعی آزمون قیمت",
          },
        })
      ).status(),
    ).toBe(200);
    const prices = editor.locator(".wholesale-price-manager");
    await prices
      .getByRole("button", { name: "تازه‌سازی قیمت‌ها و همکارها" })
      .click();
    const packId = (
      await client.query(
        'SELECT id FROM "PackDefinition" WHERE "productId"=$1',
        [productId],
      )
    ).rows[0].id;
    await prices
      .getByRole("combobox", { name: "جین فعال", exact: true })
      .selectOption(packId);
    await prices.getByLabel("همکار دریافت‌کنندهٔ قیمت").selectOption(partnerId);
    await prices
      .getByLabel("قیمت عمدهٔ هر واحد (تومان)", { exact: true })
      .fill("1234567");
    await prices
      .getByLabel("شروع اعتبار (زمان محلی دستگاه)")
      .fill(new Date(Date.now() - 60000).toISOString().slice(0, 16));
    await prices
      .getByLabel("دلیل ثبت قیمت", { exact: true })
      .fill("داده مصنوعی قیمت آزمون مرورگر");
    await prices
      .getByRole("button", { name: "ثبت پیش‌نویس قیمت خصوصی" })
      .click();
    await expect(
      prices.getByText(
        "پیش‌نویس قیمت ثبت شد؛ برای انتشار، تأیید پرسنل دیگری لازم است.",
      ),
    ).toBeVisible();
    await expect(
      prices.getByRole("option", { name: "تأیید مستقل و انتشار قیمت" }),
    ).toHaveCount(0);
    const reviewerHandle = "price_" + suffix,
      reviewerPassword = randomBytes(24).toString("hex"),
      reviewerSalt = randomBytes(16).toString("hex");
    reviewerId = (
      await client.query(
        'INSERT INTO "User"(kind,"displayName",handle,"passwordHash","isDemo") VALUES(\'STAFF\',\'بازبین موقت قیمت\',$1,$2,true) RETURNING id',
        [
          reviewerHandle,
          reviewerSalt +
            ":" +
            scryptSync(reviewerPassword, reviewerSalt, 64, {
              N: 32768,
              maxmem: 64 * 1024 * 1024,
            }).toString("hex"),
        ],
      )
    ).rows[0].id;
    await client.query(
      'INSERT INTO "UserRole"("userId","roleId") SELECT $1,id FROM "Role" WHERE key=\'OWNER\'',
      [reviewerId],
    );
    const reviewerPage = await reviewerContext.newPage();
    await reviewerPage.goto("/admin");
    await reviewerPage.getByLabel("شناسهٔ پرسنلی").fill(reviewerHandle);
    await reviewerPage
      .getByLabel("رمز عبور", { exact: true })
      .fill(reviewerPassword);
    await reviewerPage.getByRole("button", { name: "ادامهٔ ورود امن" }).click();
    await reviewerPage
      .getByRole("button", { name: "تنظیم تأیید دومرحله‌ای" })
      .click();
    const secondSecret = await reviewerPage
      .locator(".admin-secret")
      .textContent();
    await reviewerPage
      .getByLabel("کد تأیید یا بازیابی")
      .fill(totp(secondSecret!));
    await reviewerPage
      .getByRole("button", { name: "تأیید و ورود به مدیریت" })
      .click();
    await reviewerPage
      .getByRole("button", { name: "کدها را امن ذخیره کردم" })
      .click();
    await reviewerPage
      .getByRole("navigation", { name: "ناوبری مدیریت" })
      .getByRole("button", { name: "کاتالوگ", exact: true })
      .click();
    const reviewRecord = reviewerPage.locator("article.admin-record").filter({
      has: reviewerPage.getByRole("heading", { name, exact: true }),
    });
    await reviewRecord.locator("details.product-workbench>summary").click();
    const reviewPrice = reviewRecord.locator(
      ".wholesale-price-manager .pack-record",
    );
    await reviewPrice.getByLabel("عملیات قیمت").selectOption("PUBLISHED");
    await reviewPrice
      .getByLabel("دلیل تصمیم قیمت")
      .fill("بازبینی مستقل داده مصنوعی قیمت");
    await reviewPrice.getByRole("button", { name: "ثبت تصمیم قیمت" }).click();
    await expect(reviewPrice.getByText(/منتشرشده/)).toBeVisible();
    for (const width of [360, 390, 768, 1440]) {
      await reviewerPage.setViewportSize({ width, height: 1000 });
      expect(
        await reviewerPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "price editor overflow " + width,
      ).toBe(true);
    }
    await buyerPage.goto("/wholesale");
    await expect(buyerPage.locator(".private-price-card")).toHaveCount(1);
    await expect(buyerPage.locator(".private-price-card")).toContainText(
      new Intl.NumberFormat("fa-IR").format(1234567),
    );
    await buyerPage
      .getByRole("button", { name: "افزودن یک جین به سبد سروری", exact: true })
      .click();
    await buyerPage
      .getByRole("link", { name: "دیدن سبد سروری", exact: true })
      .click();
    await buyerPage
      .getByRole("button", { name: "سبد عمده", exact: true })
      .click();
    await expect(buyerPage.locator(".server-cart-line")).toHaveCount(1);
    await buyerPage
      .getByRole("button", { name: "بررسی موجودی و محاسبهٔ سروری" })
      .click();
    await expect(
      buyerPage.getByRole("region", { name: "نتیجه محاسبه سروری" }),
    ).toContainText(new Intl.NumberFormat("fa-IR").format(7407402));
    await buyerPage.getByLabel("تعداد انتخاب (صفر برای حذف)").fill("2");
    await buyerPage.getByRole("button", { name: "ثبت تعداد در سرور" }).click();
    await expect(buyerPage.locator(".server-cart-line")).toContainText(
      "تعداد ثبت‌شده: ۲",
    );
    await buyerPage
      .getByRole("button", { name: "بررسی موجودی و محاسبهٔ سروری" })
      .click();
    await expect(buyerPage.locator("main").getByRole("alert")).toContainText(
      "موجودی کل ترکیب سبد کافی نیست",
    );
    await expect(
      buyerPage.getByRole("region", { name: "نتیجه محاسبه سروری" }),
    ).toHaveCount(0);
    await buyerPage.goto("/p/" + productId);
    await buyerPage
      .getByRole("dialog")
      .getByRole("button", { name: "افزودن به سبد سروری", exact: true })
      .click();
    await buyerPage
      .getByRole("dialog")
      .getByRole("link", { name: "دیدن سبد سروری", exact: true })
      .click();
    await expect(buyerPage.locator(".server-cart-line")).toHaveCount(1);
    await buyerPage.getByLabel("تعداد انتخاب (صفر برای حذف)").fill("2");
    await buyerPage.getByRole("button", { name: "ثبت تعداد در سرور" }).click();
    await expect(buyerPage.locator(".server-cart-line")).toContainText(
      "تعداد ثبت‌شده: ۲",
    );
    await buyerPage.reload();
    await expect(buyerPage.locator(".server-cart-line")).toContainText(
      "تعداد ثبت‌شده: ۲",
    );
    await buyerPage
      .getByRole("button", { name: "بررسی موجودی و محاسبهٔ سروری" })
      .click();
    await expect(
      buyerPage.getByRole("region", { name: "نتیجه محاسبه سروری" }),
    ).toContainText(new Intl.NumberFormat("fa-IR").format(500000));
    for (const width of [360, 390, 768, 1440]) {
      await buyerPage.setViewportSize({ width, height: 900 });
      expect(
        await buyerPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "basket overflow " + width,
      ).toBe(true);
    }
    await buyerPage
      .getByRole("checkbox", {
        name: "جمع و اقلام بالا را برای سفارش اولیهٔ بدون پرداخت تأیید می‌کنم.",
      })
      .check();
    await buyerPage
      .getByRole("button", {
        name: "ثبت سفارش اولیه و رزرو موجودی",
        exact: true,
      })
      .click();
    const history = buyerPage.getByRole("region", {
      name: "سفارش‌های اولیه من",
    });
    await expect(history.locator("article")).toHaveCount(1);
    await expect(history).toContainText("رزرو فعال");
    for (const width of [360, 390, 768, 1440]) {
      await buyerPage.setViewportSize({ width, height: 900 });
      expect(
        await buyerPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "order history overflow " + width,
      ).toBe(true);
    }

    await expect(buyerPage.locator("main > .server-cart-line")).toHaveCount(0);
    await buyerPage.reload();
    await expect(history.locator("article")).toHaveCount(1);
    await history
      .getByRole("button", { name: "لغو سفارش و آزادسازی رزرو" })
      .click();
    await expect(history).toContainText("لغوشده");
    await expect(
      history.getByRole("button", { name: "لغو سفارش و آزادسازی رزرو" }),
    ).toHaveCount(0);
    const reservations = await client.query(
      'SELECT reserved FROM "ProductVariant" WHERE "productId"=$1',
      [productId],
    );
    expect(reservations.rows.every((r) => r.reserved === 0)).toBe(true);
    await buyerPage.goto("/wholesale");
    for (const path of ["/", "/p/" + productId, "/api/catalog"]) {
      const publicText = await (
        await page.request.get(path, { headers: { Cookie: "" } })
      ).text();
      expect(publicText).not.toContain("1234567");
      expect(publicText).not.toContain(
        new Intl.NumberFormat("fa-IR").format(1234567),
      );
    }
    expect(
      (
        await page.request.get("/api/wholesale/catalog", {
          headers: { Cookie: "" },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.put(
          "/api/admin/partners/" + partnerId + "/validity",
          {
            headers: { Origin: "http://127.0.0.1:3000" },
            data: {
              expiresAt: new Date(Date.now() - 1000).toISOString(),
              version: 2,
              reason: "انقضای دسترسی آزمون قیمت",
            },
          },
        )
      ).status(),
    ).toBe(200);
    await buyerPage
      .getByRole("button", { name: "بررسی دوبارهٔ دسترسی و قیمت‌ها" })
      .click();
    await expect(buyerPage.locator(".private-price-card")).toHaveCount(0);
    await expect(
      buyerPage.locator(".private-wholesale").getByRole("alert"),
    ).toBeVisible();
    await page.goto("/p/" + productId);
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "کیف کوچک واقعی آزمون" }),
    ).toBeVisible();
    expect(
      (
        await page.request.get("/api/media/" + mediaId, {
          headers: { Cookie: "" },
        })
      ).status(),
    ).toBe(200);
    await page.goto("/admin");
    await page
      .getByRole("navigation", { name: "ناوبری مدیریت" })
      .getByRole("button", { name: "کاتالوگ", exact: true })
      .click();
    await editor.locator("summary").first().click();
    await editor
      .getByLabel("دلیل تغییر وضعیت", { exact: true })
      .fill("پایان آزمون و بایگانی");
    await editor
      .getByRole("button", { name: "بایگانی کالا", exact: true })
      .click();
    await expect(
      editor.getByRole("button", { name: "بازگردانی به پیش‌نویس" }),
    ).toBeVisible();
    expect((await page.request.get("/p/" + productId)).status()).toBe(404);
  } finally {
    // Privileged fixture cleanup is strictly scoped to the new actor's product.
    // Do not truncate ledgers or disable triggers globally in the shared demo DB.
    if (ownerId && productId) {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL session_replication_role = 'replica'");
        if (buyerId) {
          await client.query(
            'DELETE FROM "ReservationMovement" m USING "PurchaseOrder" o,"User" u WHERE m."orderId"=o.id AND o."userId"=u.id AND u.id=$1 AND u."isDemo"=true AND u.kind=\'CUSTOMER\'',
            [buyerId],
          );
          await client.query(
            'DELETE FROM "OrderHold" h USING "PurchaseOrder" o,"User" u WHERE h."orderId"=o.id AND o."userId"=u.id AND u.id=$1 AND u."isDemo"=true AND u.kind=\'CUSTOMER\'',
            [buyerId],
          );
          await client.query(
            'DELETE FROM "PurchaseOrder" o USING "User" u WHERE o."userId"=u.id AND u.id=$1 AND u."isDemo"=true AND u.kind=\'CUSTOMER\'',
            [buyerId],
          );
          await client.query(
            'DELETE FROM "CartOperation" o USING "ServerCart" c,"User" u WHERE o."cartId"=c.id AND c."userId"=u.id AND u.id=$1 AND u."isDemo"=true AND u.kind=\'CUSTOMER\'',
            [buyerId],
          );
          await client.query(
            'DELETE FROM "ServerCartLine" l USING "ServerCart" c,"User" u WHERE l."cartId"=c.id AND c."userId"=u.id AND u.id=$1 AND u."isDemo"=true AND u.kind=\'CUSTOMER\'',
            [buyerId],
          );
          await client.query(
            'DELETE FROM "ServerCart" c USING "User" u WHERE c."userId"=u.id AND u.id=$1 AND u."isDemo"=true AND u.kind=\'CUSTOMER\'',
            [buyerId],
          );
        }

        await client.query(
          'DELETE FROM "InventoryMovement" m USING "ProductVariant" v,"Product" p WHERE m."variantId"=v.id AND v."productId"=p.id AND p.id=$1 AND EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."resourceId"=p.id AND a."actorId"=$2 AND a.action=\'product:draft_create\')',
          [productId, ownerId],
        );
        await client.query(
          'DELETE FROM "WholesaleOffer" o USING "AuditLog" a WHERE o."productId"=$1 AND a."resourceId"=$1 AND a."actorId"=$2 AND a.action=\'product:draft_create\'',
          [productId, ownerId],
        );
        await client.query(
          'DELETE FROM "PackComponent" c USING "PackDefinition" b,"AuditLog" a WHERE c."packId"=b.id AND b."productId"=$1 AND a."resourceId"=$1 AND a."actorId"=$2 AND a.action=\'product:draft_create\'',
          [productId, ownerId],
        );
        await client.query(
          'DELETE FROM "PackDefinition" b USING "AuditLog" a WHERE b."productId"=$1 AND a."resourceId"=$1 AND a."actorId"=$2 AND a.action=\'product:draft_create\'',
          [productId, ownerId],
        );
        await client.query(
          'DELETE FROM "ProductVariant" v USING "Product" p WHERE v."productId"=p.id AND p.id=$1 AND EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."resourceId"=p.id AND a."actorId"=$2 AND a.action=\'product:draft_create\')',
          [productId, ownerId],
        );
        await client.query(
          'DELETE FROM "Product" p WHERE p.id=$1 AND EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."resourceId"=p.id AND a."actorId"=$2 AND a.action=\'product:draft_create\')',
          [productId, ownerId],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
    if (mediaId && ownerId) {
      const removed = await client.query(
        'DELETE FROM "MediaAsset" WHERE id=$1 AND "createdBy"=$2 AND NOT EXISTS(SELECT 1 FROM "Product" WHERE "imagePath"=$3) RETURNING id',
        [mediaId, ownerId, "/api/media/" + mediaId],
      );
      if (removed.rowCount) {
        const { unlink } = await import("node:fs/promises");
        await unlink(process.cwd() + "/.data/media/" + mediaId + ".webp").catch(
          () => {},
        );
      }
    }
    if (buyerId) {
      await client.query('DELETE FROM "PartnerAccount" WHERE "userId"=$1', [
        buyerId,
      ]);
      await client.query('DELETE FROM "User" WHERE id=$1', [buyerId]);
    }
    if (reviewerId)
      await client.query('DELETE FROM "User" WHERE id=$1', [reviewerId]);
    if (ownerId)
      await client.query('DELETE FROM "User" WHERE id=$1', [ownerId]);
    await client.end();
    await reviewerContext.close().catch(() => {});
    await buyerContext.close().catch(() => {});
  }
});
