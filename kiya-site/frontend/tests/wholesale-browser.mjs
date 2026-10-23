import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchBrowser } from "./browser-harness.mjs";
import { formatToman } from "../src/services/wholesale.ts";
const base = "http://127.0.0.1:3110";
const fixture = JSON.parse(
  readFileSync(
    new URL("../../backend/.data/wholesale-ui-fixture.json", import.meta.url),
    "utf8",
  ),
);
const browser = await launchBrowser(),
  errors = [];
async function open(who) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  if (who) {
    const cookie = fixture.users[who].cookie;
    const i = cookie.indexOf("=");
    await context.addCookies([
      {
        name: cookie.slice(0, i),
        value: cookie.slice(i + 1),
        url: base,
        sameSite: "Lax",
      },
    ]);
  }
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/#wholesale");
  return { context, page };
}
try {
  for (const [who, title] of [
    [null, "برای ثبت درخواست همکاری وارد حساب شوید"],
    ["pending", "در انتظار بررسی پشتیبانی"],
    ["suspended", "دسترسی تعلیق‌شده"],
    ["rejected", "درخواست رد شده"],
    ["expired", "اعتبار همکاری پایان یافته"],
  ]) {
    const { context, page } = await open(who);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    assert.equal(
      await page
        .getByText(formatToman(fixture.unitPrice), { exact: true })
        .count(),
      0,
      "no unauthorized rate for " + who,
    );
    assert.equal(
      await page.locator('[aria-label="قیمت اختصاصی همکار"]').count(),
      0,
    );
    await context.close();
  }
  {
    const { context, page } = await open("outsider");
    await page
      .getByLabel("نام فروشگاه / گالری / پیج", { exact: true })
      .fill("فروشگاه آزمون مرورگر");
    await page.getByLabel("شهر محل فعالیت", { exact: true }).fill("شهر آزمون");
    await page
      .getByLabel("توضیحات همکاری و نشانی فروشگاه یا پیج", { exact: true })
      .fill("داده مصنوعی برای آزمون ثبت و ماندگاری درخواست");
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/partner") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", {
        name: "ارسال درخواست به واحد امور همکاران",
        exact: true,
      })
      .click();
    assert.equal((await response).status(), 201);
    await page
      .getByRole("heading", { name: "در انتظار بررسی پشتیبانی", exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByRole("heading", { name: "در انتظار بررسی پشتیبانی", exact: true })
      .waitFor();
    assert.equal(
      await page.locator('[aria-label="قیمت اختصاصی همکار"]').count(),
      0,
    );
    await context.close();
  }
  {
    const { context, page } = await open("inquiry");
    await page
      .getByText(
        "نرخ استعلامی است؛ قیمت قابل سفارش منتشر نشده. برای قیمت با مسئول همکاری تماس بگیرید.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "افزودن جین به سبد عمده", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByText(formatToman(fixture.unitPrice), { exact: true })
        .count(),
      0,
    );
    await context.close();
  }
  const { context, page } = await open("approved");
  const privateSection = page.locator('[aria-label="قیمت اختصاصی همکار"]');
  await privateSection
    .getByText(formatToman(fixture.unitPrice), { exact: true })
    .waitFor();
  assert.equal(
    await privateSection.getByRole("button", { name: /کاهش جین/ }).isDisabled(),
    true,
    "one pack is sufficient and no fractional pack",
  );
  const added = page.waitForResponse(
    (r) => r.url().endsWith("/api/cart") && r.request().method() === "POST",
  );
  await privateSection
    .getByRole("button", { name: "افزودن جین به سبد عمده", exact: true })
    .click();
  assert.equal((await added).status(), 200);
  const dialog = page.getByRole("dialog", { name: "سبد سروری", exact: true });
  await dialog
    .getByRole("heading", { name: "سبد سروری عمده", exact: true })
    .waitFor();
  const increase = page.waitForResponse(
    (r) => r.url().endsWith("/api/cart") && r.request().method() === "PATCH",
  );
  await dialog.getByRole("button", { name: /^افزایش تعداد / }).click();
  assert.equal((await increase).status(), 200);
  await dialog.getByText(/تعداد: 2/).waitFor();
  const decrease = page.waitForResponse(
    (r) => r.url().endsWith("/api/cart") && r.request().method() === "PATCH",
  );
  await dialog.getByRole("button", { name: /^کاهش تعداد / }).click();
  assert.equal((await decrease).status(), 200);
  await dialog.getByText(/تعداد: 1/).waitFor();
  await dialog
    .getByRole("button", { name: "محاسبهٔ قیمت جاری از سرور", exact: true })
    .click();
  const total = (BigInt(fixture.unitPrice) * BigInt(fixture.units)).toString();
  await dialog
    .getByText("جمع کالا: " + total + " تومان", { exact: true })
    .waitFor();
  // Simulate hiding the tab: already displayed private rates/quotes must disappear.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await privateSection.waitFor({ state: "detached" });
  assert.equal(
    await dialog
      .getByText("جمع کالا: " + total + " تومان", { exact: true })
      .count(),
    0,
  );
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await dialog
    .getByRole("button", { name: "محاسبهٔ قیمت جاری از سرور", exact: true })
    .click();
  await dialog
    .getByText("جمع کالا: " + total + " تومان", { exact: true })
    .waitFor();
  const reserve = dialog.getByRole("button", {
    name: "ایجاد رزرو موقت بدون پرداخت",
    exact: true,
  });
  assert.equal(await reserve.isDisabled(), true);
  await dialog.getByRole("checkbox").check();
  const reserved = page.waitForResponse(
    (r) => r.url().endsWith("/api/orders") && r.request().method() === "POST",
  );
  await reserve.click();
  const response = await reserved;
  assert.equal(response.status(), 200);
  const order = (await response.json()).data;
  await page.getByText(order.id, { exact: true }).waitFor();
  await page.reload();
  await page.getByText(order.id, { exact: true }).waitFor();
  const cancelled = page.waitForResponse(
    (r) => r.url().includes("/cancel") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "لغو رزرو و آزادسازی موجودی", exact: true })
    .click();
  assert.equal((await cancelled).status(), 200);
  await page.getByText(/وضعیت: CANCELLED/).waitFor();
  await page.goto(base + "/#wholesale");
  await privateSection
    .getByText(formatToman(fixture.unitPrice), { exact: true })
    .waitFor();
  const denied = await page.request.patch(
    base + "/api/admin/partners/" + fixture.users.approved.partnerId,
    {
      headers: { origin: base, cookie: fixture.reviewerCookie },
      data: {
        status: "SUSPENDED",
        version: 1,
        reason: "تعلیق مصنوعی برای آزمون حذف قیمت خصوصی",
      },
    },
  );
  assert.equal(denied.status(), 200);
  await page
    .getByRole("button", { name: "دریافت وضعیت و قیمت جاری", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "دسترسی تعلیق‌شده", exact: true })
    .waitFor();
  assert.equal(await privateSection.count(), 0);
  assert.equal(
    await page
      .getByText(formatToman(fixture.unitPrice), { exact: true })
      .count(),
    0,
    "revocation removes rates, never falls back to public/other partner price",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile wholesale overflow",
  );
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "PASS: anonymous/pending/rejected/suspended/expired price isolation, real persisted partner application, inquiry without zero-price checkout, approved private BOM and three prices, one-pack server cart/quantity edits/quote/privacy on tab hide/reservation/order persistence/cancellation, revocation and mobile layout. Isolated kiya_test only; no payment or SMS exercised.",
  );
} finally {
  await browser.close();
}
