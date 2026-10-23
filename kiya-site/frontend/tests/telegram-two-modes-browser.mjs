import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchBrowser } from "./browser-harness.mjs";
const require = createRequire(
    new URL("../../backend/package.json", import.meta.url),
  ),
  { parse } = require("dotenv"),
  { Client } = require("pg"),
  env = parse(
    readFileSync(new URL("../../backend/.env.local", import.meta.url)),
  );
const dbUrl = new URL(env.TEST_DATABASE_URL);
assert.equal(dbUrl.pathname, "/kiya_test");
assert(["localhost", "127.0.0.1"].includes(dbUrl.hostname));
const db = new Client({ connectionString: dbUrl.href });
await db.connect();
const fixture = JSON.parse(
    readFileSync(
      new URL("../../backend/.data/wholesale-ui-fixture.json", import.meta.url),
      "utf8",
    ),
  ),
  base = "http://127.0.0.1:3110",
  browser = await launchBrowser();
try {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage(),
    errors = [];
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
    .getByRole("heading", { name: "۲. کد یک‌بارمصرف در تلگرام", exact: true })
    .waitFor();
  const update = async (body) =>
    assert.equal(
      (
        await page.request.post(base + "/api/webhooks/telegram", {
          headers: {
            "x-telegram-bot-api-secret-token": fixture.telegramSecret,
          },
          data: body,
        })
      ).status(),
      200,
    );
  await update({
    update_id: 920001,
    message: {
      from: { id: 666001, first_name: "آزمون دو روش ورود" },
      chat: { id: 666001, type: "private" },
      text: "/start",
    },
  });
  await update({
    update_id: 920002,
    message: {
      from: { id: 666001 },
      chat: { id: 666001, type: "private" },
      contact: { user_id: 666001, phone_number: "989999999997" },
    },
  });
  await page.getByLabel("شماره موبایل", { exact: true }).fill("09999999997");
  const requesting = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/telegram") &&
      r.request().postDataJSON()?.action === "otp-start",
  );
  await page
    .getByRole("button", { name: "دریافت کد در تلگرام", exact: true })
    .click();
  const response = await requesting;
  assert.equal(response.status(), 201);
  const challenge = (await response.json()).data;
  assert(!("code" in challenge));
  const result = await db.query(
    `SELECT text FROM "TelegramOutbox" WHERE "chatId"=666001 AND text LIKE 'otp-encrypted:%' ORDER BY "createdAt" DESC LIMIT 1`,
  );
  const [iv, tag, body] = result.rows[0].text.slice(14).split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(env.MFA_ENCRYPTION_KEY, "hex"),
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(body, "hex")),
    decipher.final(),
  ]).toString("utf8");
  const code = plaintext.match(/: (\d{6})/)[1];
  await page.getByLabel("کد یک‌بارمصرف تلگرام", { exact: true }).fill("000000");
  await page
    .getByRole("button", { name: "تأیید کد و ورود", exact: true })
    .click();
  await page.getByRole("alert").filter({ hasText: "کد معتبر نیست." }).waitFor();
  await page.getByLabel("کد یک‌بارمصرف تلگرام", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "تأیید کد و ورود", exact: true })
    .click();
  await page
    .getByRole("button", { name: "خروج از حساب", exact: true })
    .waitFor();
  const before = (await (await page.request.get(base + "/api/auth/me")).json())
    .data.user;
  assert.equal(before.kind, "CUSTOMER");
  assert.deepEqual(before.permissions, []);
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await page
    .getByRole("heading", { name: "ورود با حساب تلگرام", exact: true })
    .waitFor();
  const starting = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/telegram") &&
      r.request().postDataJSON()?.action === "start",
  );
  await page
    .getByRole("button", { name: "ورود مستقیم با ربات", exact: true })
    .click();
  const direct = (await (await starting).json()).data,
    selector = new URL(direct.link).searchParams.get("start").slice(6);
  await update({
    update_id: 920003,
    message: {
      from: { id: 666001, first_name: "آزمون دو روش ورود" },
      chat: { id: 666001, type: "private" },
      text: "/start login_" + selector,
    },
  });
  await page.bringToFront();
  await page
    .getByRole("button", { name: "خروج از حساب", exact: true })
    .waitFor();
  await page.bringToFront();
  const after = (await (await page.request.get(base + "/api/auth/me")).json())
    .data.user;
  assert.equal(after.id, before.id);
  assert.equal(after.adminAccess, false);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "PASS: OTP received through synthetic private bot outbox, wrong code rejected, real browser OTP login/logout; then private deep-link Start alone automatically signs same browser into same identity with no callbacks/extra confirmation; mobile and JS clean. No real provider messages sent.",
  );
} finally {
  await browser.close();
  await db.end();
}
