import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchBrowser } from "./browser-harness.mjs";
const require = createRequire(
    new URL("../../backend/package.json", import.meta.url),
  ),
  sharp = require("sharp");
const f = JSON.parse(
  readFileSync(
    new URL("../../backend/.data/wholesale-ui-fixture.json", import.meta.url),
    "utf8",
  ),
);
const base = "http://127.0.0.1:3110",
  browser = await launchBrowser(),
  errors = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/#account");
  await context.route("https://t.me/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: "Synthetic Telegram navigation; no provider request.",
    }),
  );
  await page
    .getByRole("heading", { name: "ورود با حساب تلگرام", exact: true })
    .waitFor();
  assert.equal(
    await page.getByText("پرش به محتوای اصلی", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByText(
        "کاتالوگ، دیدگاه و سبد به سرور متصل‌اند؛ بخش‌های محتوایی هنوز در حال تکمیل‌اند. پرداخت آنلاین و پیامک فعال نیست.",
        { exact: true },
      )
      .count(),
    0,
  );
  const started = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/telegram") &&
      r.request().postDataJSON()?.action === "start",
  );
  await page
    .getByRole("button", { name: "ورود مستقیم با ربات", exact: true })
    .click();
  const startResponse = await started;
  assert.equal(startResponse.status(), 201);
  const c = (await startResponse.json()).data;
  await page.getByText(c.code, { exact: true }).waitFor();
  const selector = new URL(c.link).searchParams.get("start").slice(6);
  for (const update of [
    {
      update_id: 900001,
      message: {
        from: { id: 333001, first_name: "مشتری مصنوعی مرورگر" },
        chat: { id: 333001, type: "private" },
        text: "/start login_" + selector,
      },
    },
    {
      update_id: 900002,
      callback_query: {
        from: { id: 333001, first_name: "مشتری مصنوعی مرورگر" },
        message: { chat: { id: 333001, type: "private" } },
        data: "confirm:" + selector,
      },
    },
  ]) {
    const response = await page.request.post(base + "/api/webhooks/telegram", {
      headers: { "x-telegram-bot-api-secret-token": f.telegramSecret },
      data: update,
    });
    assert.equal(response.status(), 200);
  }

  await page.bringToFront();
  await page
    .getByRole("button", { name: "خروج از حساب", exact: true })
    .waitFor();
  const me = (await (await page.request.get(base + "/api/auth/me")).json()).data
    .user;
  assert.equal(me.kind, "CUSTOMER");
  assert.equal(me.isDemo, false);
  assert.deepEqual(me.permissions, []);
  const catalog = (await (await page.request.get(base + "/api/catalog")).json())
    .data.items;
  const product = catalog.find((p) => p.id === f.productId);
  assert(product);
  await page.goto(base + "/#feed");
  const article = page
    .locator("main article")
    .filter({
      has: page.getByRole("button", { name: product.name, exact: true }),
    })
    .first();
  await article
    .getByRole("button", { name: "افزودن به سبد", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "سبد سروری", exact: true });
  await dialog
    .getByRole("button", { name: "محاسبهٔ قیمت جاری از سرور", exact: true })
    .click();
  await dialog.getByRole("checkbox").check();
  const placing = page.waitForResponse(
    (r) => r.url().endsWith("/api/orders") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "ایجاد رزرو موقت بدون پرداخت", exact: true })
    .click();
  const orderResponse = await placing;
  assert.equal(orderResponse.status(), 200);
  const order = (await orderResponse.json()).data;
  await page.getByText(order.id, { exact: true }).waitFor();
  const payment = page.locator('[aria-label="پرداخت کارت به کارت"]');
  await payment
    .getByLabel("نام گیرنده", { exact: true })
    .fill("گیرنده مصنوعی مرورگر");
  await payment
    .getByLabel("شماره تماس گیرنده", { exact: true })
    .fill("09999999999");
  await payment.getByLabel("شهر", { exact: true }).fill("شهر آزمون");
  await payment
    .getByLabel("کد پستی ده‌رقمی", { exact: true })
    .fill("9999999999");
  await payment
    .getByLabel("نشانی کامل", { exact: true })
    .fill("نشانی مصنوعی مرورگر فقط برای آزمون یکپارچه");
  const creating = page.waitForResponse(
    (r) => r.url().endsWith("/api/payments") && r.request().method() === "POST",
  );
  await payment
    .getByRole("button", {
      name: "دریافت شماره کارت و مبلغ نهایی",
      exact: true,
    })
    .click();
  const paymentResponse = await creating;
  assert.equal(paymentResponse.status(), 200);
  const intent = (await paymentResponse.json()).data;
  assert.equal(
    intent.amountToman,
    (BigInt(order.subtotalToman) + 10000n).toString(),
  );
  assert.equal(intent.status, "AWAITING_TRANSFER");
  await payment
    .getByLabel("کد پیگیری واریز", { exact: true })
    .fill("SYNTHETIC-BROWSER-REFERENCE");
  const bytes = await sharp({
    create: { width: 350, height: 350, channels: 3, background: "#914f21" },
  })
    .png()
    .toBuffer();
  await payment.locator("input[type=file]").setInputFiles({
    name: "synthetic-receipt.png",
    mimeType: "image/png",
    buffer: bytes,
  });
  await payment
    .getByRole("button", { name: "ثبت خصوصی رسید برای بررسی", exact: true })
    .click();
  await payment
    .getByText("رسید ثبت شد؛ در انتظار تطبیق بانک", { exact: true })
    .waitFor();
  await page.reload();
  await payment
    .getByText("رسید ثبت شد؛ در انتظار تطبیق بانک", { exact: true })
    .waitFor();
  assert.equal(await page.getByText(/وضعیت: PAID/).count(), 0);
  const receipt = await page.request.get(
    base + "/api/payments/" + intent.id + "/receipt",
  );
  assert.equal(receipt.status(), 200);
  assert.equal(receipt.headers()["cache-control"], "private, no-store");
  const adminContext = await browser.newContext();
  const split = f.reviewerCookie.indexOf("=");
  await adminContext.addCookies([
    {
      name: f.reviewerCookie.slice(0, split),
      value: f.reviewerCookie.slice(split + 1),
      url: base,
      sameSite: "Lax",
    },
  ]);
  const admin = await adminContext.newPage();
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto(base + "/admin/settings");
  await admin
    .getByRole("button", { name: "ذخیره امن تنظیمات", exact: true })
    .waitFor();
  assert.equal(
    await admin.locator("input[type=password]").first().inputValue(),
    "",
  );
  await adminContext.clearCookies();
  const financeSplit = f.financeCookie.indexOf("=");
  await adminContext.addCookies([
    {
      name: f.financeCookie.slice(0, financeSplit),
      value: f.financeCookie.slice(financeSplit + 1),
      url: base,
      sameSite: "Lax",
    },
  ]);
  await admin.goto(base + "/admin/payments");
  assert.equal(
    (await admin.request.get(base + "/api/admin/settings")).status(),
    403,
  );
  const section = admin.locator("section").filter({
    has: admin.getByRole("heading", {
      name: "سفارش " + order.id,
      exact: true,
    }),
  });
  await section
    .getByLabel("شرح بررسی بانک", { exact: true })
    .fill("تطبیق کاملاً مصنوعی برای آزمون نرم‌افزار، نه انتقال واقعی وجه");
  await section
    .getByLabel("شناسهٔ یکتای ردیف گردش بانک (از بانک، نه ادعای مشتری)", {
      exact: true,
    })
    .fill("2026-10-23:SYNTHETIC-BROWSER-BANK-ENTRY-001");
  const approve = section.getByRole("button", {
    name: "تأیید واریز تطبیق‌یافته",
    exact: true,
  });
  assert.equal(await approve.isDisabled(), true);
  await section.getByRole("checkbox").check();
  await approve.click();
  await section.getByText(/وضعیت: CONFIRMED/).waitFor();
  await payment
    .getByRole("button", { name: "بازخوانی وضعیت پرداخت و سفارش", exact: true })
    .click();
  await page.getByText(/وضعیت: PAID/).waitFor();
  await page.reload();
  await page.getByText(/وضعیت: PAID/).waitFor();
  await payment
    .getByText("پرداخت توسط مسئول مجاز تأیید شد", { exact: true })
    .waitFor();
  // Finance permission alone must never grant access to private shipping operations.
  assert.equal(
    (await admin.request.get(base + "/api/admin/orders")).status(),
    403,
  );
  await adminContext.clearCookies();
  await adminContext.addCookies([
    {
      name: f.reviewerCookie.slice(0, split),
      value: f.reviewerCookie.slice(split + 1),
      url: base,
      sameSite: "Lax",
    },
  ]);
  await admin.goto(base + "/admin/orders");
  const shipment = admin
    .getByTestId("fulfillment-order")
    .filter({ has: admin.getByText(order.id, { exact: true }) });
  await shipment
    .getByLabel("دلیل و مستند عملیات", { exact: true })
    .fill("آماده‌سازی مصنوعی برای آزمون کامل چرخه سفارش");
  await shipment
    .getByRole("button", { name: "شروع آماده‌سازی", exact: true })
    .click();
  await shipment
    .getByRole("button", { name: "ثبت ارسال و رهگیری", exact: true })
    .waitFor();
  await shipment
    .getByLabel("شرکت حمل", { exact: true })
    .fill("پست مصنوعی آزمون");
  await shipment
    .getByLabel("کد رهگیری", { exact: true })
    .fill("SYNTHETIC-TRACK-2026");
  await shipment
    .getByLabel("دلیل و مستند عملیات", { exact: true })
    .fill("تحویل مصنوعی به شرکت حمل فقط برای آزمون");
  await shipment
    .getByRole("button", { name: "ثبت ارسال و رهگیری", exact: true })
    .click();
  await shipment
    .getByRole("button", { name: "ثبت تحویل به گیرنده", exact: true })
    .waitFor();
  await page.reload();
  const tracking = page.getByRole("region", {
    name: "پیگیری ارسال",
    exact: true,
  });
  await tracking.getByText(/SYNTHETIC-TRACK-2026/).waitFor();
  await tracking
    .getByText("تحویل به شرکت حمل ثبت شده است", { exact: true })
    .waitFor();
  await shipment
    .getByLabel("دلیل و مستند عملیات", { exact: true })
    .fill("تأیید مصنوعی دریافت مرسوله در آزمون نرم‌افزار");
  await shipment.getByRole("checkbox").check();
  await shipment
    .getByRole("button", { name: "ثبت تحویل به گیرنده", exact: true })
    .click();
  await shipment.getByText(/تحویل ثبت‌شده/).waitFor();
  assert.equal(await shipment.locator("form").count(), 0);
  await admin.setViewportSize({ width: 390, height: 844 });
  assert(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "shipping admin mobile overflow",
  );
  await page.reload();
  await page
    .getByText("تحویل به گیرنده توسط مسئول ارسال ثبت شده است", { exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile payment overflow",
  );
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await page
    .getByRole("heading", { name: "ورود با حساب تلگرام", exact: true })
    .waitFor();
  assert.equal(
    (
      await page.request.get(base + "/api/payments/" + intent.id + "/receipt")
    ).status(),
    401,
  );
  assert.deepEqual(errors, []);
  await adminContext.close();
  await context.close();
  console.log(
    "PASS: Telegram browser-bound link/confirmation/customer session, public banner removal, real storefront cart/reservation, shipping/server-only total, private receipt pending/reload, MFA staff manual reconciliation and PAID stock capture, role-protected preparation/dispatch/tracking/delivery through admin UI and customer account, logout privacy and mobile. Telegram updates and bank reconciliation are synthetic local tests; no real provider or money used.",
  );
} finally {
  await browser.close();
}
