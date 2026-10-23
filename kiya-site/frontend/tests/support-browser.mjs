import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchBrowser } from "./browser-harness.mjs";
const require = createRequire(
    new URL("../../backend/package.json", import.meta.url),
  ),
  env = require("dotenv").parse(
    readFileSync(new URL("../../backend/.env.local", import.meta.url)),
  ),
  url = new URL(env.TEST_DATABASE_URL);
assert.equal(url.pathname, "/kiya_test");
assert(["127.0.0.1", "localhost"].includes(url.hostname));
const fixture = JSON.parse(
    readFileSync(
      new URL("../../backend/.data/wholesale-ui-fixture.json", import.meta.url),
    ),
  ),
  base = "http://127.0.0.1:3110",
  browser = await launchBrowser(),
  errors = [];
async function contextWithCookie(cookie) {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    i = cookie.indexOf("=");
  if (cookie)
    await context.addCookies([
      {
        name: cookie.slice(0, i),
        value: cookie.slice(i + 1),
        url: base,
        sameSite: "Lax",
      },
    ]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
// Reset only this suite's private support fixtures and rate counters on the guarded test DB.
const db = new (require("pg").Client)({ connectionString: url.href });
await db.connect();
try {
  await db.query('TRUNCATE "SupportMessage","SupportThread"');
  await db.query('DELETE FROM "RateBucket"');
} finally {
  await db.end();
}
const subject = "پیگیری خصوصی مرورگر",
  first = "متن خصوصی مشتری <img src=x onerror=window.supportXSS=1>",
  note = "INTERNAL-BROWSER-NOTE-NEVER-PUBLIC",
  reply = "پاسخ عمومی پشتیبانی ثبت‌شده روی سرور";
try {
  const { context, page } = await contextWithCookie("");
  const demo = await page.request.post(base + "/api/auth/demo", {
    headers: { origin: base },
    data: {},
  });
  assert.equal(demo.status(), 201);
  await page.goto(base + "/#inbox");
  await page.getByLabel("موضوع", { exact: true }).fill(subject);
  await page.getByLabel("متن درخواست", { exact: true }).fill(first);
  await page
    .getByRole("button", { name: "ثبت درخواست پشتیبانی", exact: true })
    .click();
  await page
    .getByRole("list", { name: "پیام‌های گفت‌وگو", exact: true })
    .getByText(first, { exact: true })
    .waitFor();
  assert.equal(await page.evaluate(() => window.supportXSS), undefined);
  const threads = await (await page.request.get(base + "/api/support")).json(),
    thread = threads.data.items.find((t) => t.subject === subject);
  assert(thread);
  await page.reload();
  await page
    .getByRole("button", { name: subject + " · باز", exact: true })
    .click();
  await page.getByText(first, { exact: true }).waitFor();
  const admin = await contextWithCookie(fixture.reviewerCookie);
  await admin.page.goto(base + "/admin/support");
  await admin.page.getByRole("button").filter({ hasText: subject }).click();
  await admin.page.getByLabel("متن پیام پشتیبانی", { exact: true }).fill(note);
  await admin.page
    .getByRole("checkbox", {
      name: "یادداشت داخلی؛ برای مشتری منتشر نشود",
      exact: true,
    })
    .check();
  await admin.page
    .getByRole("button", { name: "ثبت پیام پشتیبانی", exact: true })
    .click();
  await admin.page.getByText(note, { exact: true }).waitFor();
  await admin.page
    .getByRole("checkbox", {
      name: "یادداشت داخلی؛ برای مشتری منتشر نشود",
      exact: true,
    })
    .uncheck();
  await admin.page.getByLabel("متن پیام پشتیبانی", { exact: true }).fill(reply);
  await admin.page
    .getByRole("button", { name: "ثبت پیام پشتیبانی", exact: true })
    .click();
  await admin.page.getByText(reply, { exact: true }).waitFor();
  await page.bringToFront();
  await page.reload();
  await page
    .getByRole("button", { name: subject + " · باز", exact: true })
    .click();
  await page.getByText(reply, { exact: true }).waitFor();
  assert.equal(await page.getByText(note, { exact: true }).count(), 0);
  assert(
    !JSON.stringify(
      await (await page.request.get(base + "/api/support/" + thread.id)).json(),
    ).includes(note),
  );
  const reader = await contextWithCookie(fixture.supportReaderCookie);
  await reader.page.goto(base + "/admin/support");
  await reader.page.getByRole("button").filter({ hasText: subject }).click();
  await reader.page.getByText(reply, { exact: true }).waitFor();
  assert.equal(await reader.page.getByText(note, { exact: true }).count(), 0);
  assert.equal(await reader.page.locator("form").count(), 0);
  const outsider = await contextWithCookie(fixture.users.outsider.cookie);
  await outsider.page.goto(base + "/#inbox");
  await outsider.page
    .getByText("هنوز گفت‌وگویی ثبت نکرده‌اید.", { exact: true })
    .waitFor();
  assert.equal(
    (
      await outsider.page.request.get(base + "/api/support/" + thread.id)
    ).status(),
    404,
  );
  await admin.page.bringToFront();
  await admin.page.getByRole("button").filter({ hasText: subject }).click();
  await admin.page
    .getByLabel("دلیل تغییر وضعیت", { exact: true })
    .fill("رسیدگی مصنوعی و بستن درخواست مرورگر");
  await admin.page
    .getByRole("button", { name: "بستن درخواست", exact: true })
    .click();
  await admin.page.getByText("گفت‌وگو بسته است", { exact: true }).waitFor();
  await page.bringToFront();
  await page.reload();
  await page
    .getByRole("button", { name: subject + " · بسته", exact: true })
    .click();
  await page.getByText("گفت‌وگو بسته است", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "ثبت پیام در گفت‌وگو", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "بازکردن دوباره درخواست", exact: true })
    .click();
  await page.getByText("گفت‌وگو باز است", { exact: true }).waitFor();
  await page
    .getByLabel("پیام شما", { exact: true })
    .fill("پیام پس از بازکردن درخواست");
  await page
    .getByRole("button", { name: "ثبت پیام در گفت‌وگو", exact: true })
    .click();
  await page.getByText("پیام پس از بازکردن درخواست", { exact: true }).waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "customer inbox mobile overflow",
  );
  assert(
    await admin.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "staff inbox mobile overflow",
  );
  // Actual logout in another tab broadcasts only an invalidation nonce, not user data.
  const account = await context.newPage();
  await account.goto(base + "/#account");
  await account
    .getByRole("button", { name: "خروج از حساب", exact: true })
    .click();
  await page
    .getByRole("link", {
      name: "برای پشتیبانی وارد حساب کاربری شوید",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.getByText(first, { exact: true }).count(), 0);
  assert.equal(await page.getByText(reply, { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
  await admin.context.close();
  await reader.context.close();
  await outsider.context.close();
  console.log(
    "PASS: real browser private support create/reload, escaped text, public staff reply, isolated internal notes, read-only staff, other-customer 404, close/reopen/message, mobile and cross-tab logout clearing. Test identities only; no real Telegram messages sent.",
  );
} finally {
  await browser.close();
}
