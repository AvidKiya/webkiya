import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { launchBrowser } from "./browser-harness.mjs";
const f = JSON.parse(
    readFileSync(
      new URL("../../backend/.data/wholesale-ui-fixture.json", import.meta.url),
      "utf8",
    ),
  ),
  base = "http://127.0.0.1:3110";
const browser = await launchBrowser();
function totp(secret) {
  let bits = "";
  for (const c of secret)
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(c)
      .toString(2)
      .padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2))),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest(),
    offset = hash.at(-1) & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
try {
  const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await ctx.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/#account");
  await ctx.route("https://t.me/**", (r) =>
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
    await page.getByRole("link", { name: "پنل مدیریت", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByText("ورود به مدیریت امن", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .locator("header")
      .getByText("پنل مدیریت", { exact: true })
      .count(),
    0,
  );
  async function login(index, contact) {
    const waiting = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/auth/telegram") &&
        r.request().postDataJSON()?.action === "start",
    );
    await page
      .getByRole("button", {
        name: "ورود مستقیم با ربات",
        exact: true,
      })
      .click();
    const start = (await (await waiting).json()).data,
      selector = new URL(start.link).searchParams.get("start").slice(6);
    const events = [
      {
        update_id: index,
        message: {
          from: { id: 444001, first_name: "مدیر مصنوعی مرورگر" },
          chat: { id: 444001, type: "private" },
          text: "/start login_" + selector,
        },
      },
      {
        update_id: index + 1,
        callback_query: {
          from: { id: 444001 },
          message: { chat: { id: 444001, type: "private" } },
          data: "confirm:" + selector,
        },
      },
    ];
    if (contact)
      events.push({
        update_id: index + 2,
        message: {
          from: { id: 444001 },
          chat: { id: 444001, type: "private" },
          contact: { user_id: 444001, phone_number: "989999999999" },
        },
      });
    for (const event of events) {
      assert.equal(
        (
          await page.request.post(base + "/api/webhooks/telegram", {
            headers: { "x-telegram-bot-api-secret-token": f.telegramSecret },
            data: event,
          })
        ).status(),
        200,
      );
    }

    await page.bringToFront();
    await page
      .getByRole("button", { name: "خروج از حساب", exact: true })
      .waitFor();
    return (await (await page.request.get(base + "/api/auth/me")).json()).data
      .user;
  }
  const before = await login(910001, true);
  assert.equal(before.adminAccess, false);
  assert.equal(
    await page.getByRole("link", { name: "پنل مدیریت", exact: true }).count(),
    0,
  );
  const ownerCtx = await browser.newContext(),
    split = f.reviewerCookie.indexOf("=");
  await ownerCtx.addCookies([
    {
      name: f.reviewerCookie.slice(0, split),
      value: f.reviewerCookie.slice(split + 1),
      url: base,
      sameSite: "Lax",
    },
  ]);
  const owner = await ownerCtx.newPage();
  owner.on("pageerror", (e) => errors.push(e.message));
  const access = (
    await (await owner.request.get(base + "/api/admin/access")).json()
  ).data;
  const support = access.roles.find((r) => r.key === "SUPPORT");
  await owner.goto(base + "/admin");
  await owner
    .getByRole("button", { name: "تیم و دسترسی‌ها", exact: true })
    .click();
  const form = owner.getByTestId("staff-create");
  await form
    .getByText("مدیر کردن حساب کاربری تأییدشده", { exact: true })
    .click();
  assert.equal(await form.locator("input[type=password]").count(), 0);
  await form.locator("select[name=userId]").selectOption(before.id);
  await form.getByLabel(support.name, { exact: true }).check();
  await form
    .getByLabel("دلیل اعطای نقش", { exact: true })
    .fill("اعطای نقش پشتیبانی به همان حساب در آزمون مصنوعی مرورگر");
  const promoting = owner.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/staff/promote") &&
      r.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "اعطای نقش به همین حساب", exact: true })
    .click();
  assert.equal((await promoting).status(), 200);
  await page.reload();
  await page
    .getByRole("heading", { name: "ورود با حساب تلگرام", exact: true })
    .waitFor();
  const after = await login(910004, false);
  assert.equal(after.id, before.id);
  assert.equal(after.kind, "STAFF");
  assert.equal(after.canShop, true);
  assert.equal(after.adminAccess, true);
  assert.deepEqual(after.permissions, []);
  assert.equal(
    (await page.request.get(base + "/api/admin/access")).status(),
    403,
  );
  await page.getByRole("link", { name: "پنل مدیریت", exact: true }).click();
  await page
    .getByRole("button", { name: "تنظیم تأیید دومرحله‌ای", exact: true })
    .waitFor();
  assert.equal(await page.locator("input[type=password]").count(), 0);
  await page
    .getByRole("button", { name: "تنظیم تأیید دومرحله‌ای", exact: true })
    .click();
  const secret = page.locator(".admin-secret");
  await secret.waitFor();
  await page
    .getByLabel("کد تأیید یا بازیابی", { exact: true })
    .fill(totp((await secret.innerText()).trim()));
  await page
    .getByRole("button", { name: "تأیید و ورود به مدیریت", exact: true })
    .click();
  await page
    .getByRole("button", { name: "کدها را امن ذخیره کردم", exact: true })
    .click();
  await page.locator(".admin-shell").waitFor();
  assert.equal(
    (await page.request.get(base + "/api/admin/settings")).status(),
    403,
  );
  assert.equal(
    (await page.request.get(base + "/api/admin/access")).status(),
    403,
  );
  assert.equal(
    (await page.request.get(base + "/api/admin/comments")).status(),
    200,
  );
  await page.goto(base + "/#account");
  await page.getByRole("link", { name: "پنل مدیریت", exact: true }).waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await page
    .getByRole("heading", { name: "ورود با حساب تلگرام", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "پنل مدیریت", exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  await ownerCtx.close();
  await ctx.close();
  console.log(
    "PASS: no public admin strip/button; own-contact Telegram customer, owner UI promotes same account without username/password, old session revoked, same Telegram identity re-login, account-only panel link, MFA enrollment and limited SUPPORT scope, shopping access preserved, logout and mobile. Synthetic local provider only.",
  );
} finally {
  await browser.close();
}
