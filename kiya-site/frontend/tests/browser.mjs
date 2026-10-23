import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(join(root, "backend/package.json"));
const { chromium: playwright } = require("playwright");
const Chromium = require("@sparticuz/chromium").default;
const libs = join(tmpdir(), "kiya-rebuild-browser-libs");
if (!existsSync(join(libs, "lib/libnspr4.so"))) {
  mkdirSync(libs, { recursive: true });
  const archive = join(libs, "libs.tar");
  writeFileSync(
    archive,
    brotliDecompressSync(
      readFileSync(
        join(
          root,
          "backend/node_modules/@sparticuz/chromium/bin/al2023.tar.br",
        ),
      ),
    ),
  );
  execFileSync("tar", ["-xf", archive, "-C", libs]);
}
const browser = await playwright.launch({
  headless: true,
  executablePath: await Chromium.executablePath(),
  args: Chromium.args.filter(
    (arg) =>
      ![
        "--single-process",
        "--disable-web-security",
        "--allow-running-insecure-content",
      ].includes(arg),
  ),
  env: { ...process.env, LD_LIBRARY_PATH: join(libs, "lib") },
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3100");
  await page
    .getByRole("heading", { name: "فید زنده کیا — هر روز جدید، بدون واسطه" })
    .waitFor();
  await page.locator("main article").first().waitFor();
  assert(
    (await page.locator("main article").count()) > 0,
    "template posts render",
  );
  for (const route of [
    "explore",
    "wholesale",
    "profile",
    "inbox",
    "mag",
    "account",
    "feed",
  ]) {
    await page.goto("http://127.0.0.1:3100/#" + route);
    await page.waitForFunction(
      () => document.querySelector("main")?.innerText.trim().length > 100,
    );
    assert((await page.locator("main").innerText()).length > 100);
  }
  await page.goto("http://127.0.0.1:3100/#explore");
  await page.reload();
  assert(page.url().endsWith("#explore"));
  await page.goto("http://127.0.0.1:3100/#feed");
  const search = page.getByRole("searchbox").first();
  await search.fill("unfindable-synthetic-kiya-test");
  await page
    .getByText("کالایی با این عبارت یا فیلتر پیدا نشد", { exact: true })
    .waitFor();
  await search.fill("");
  // Main template is now the real catalog; there is no separate server catalog page.
  await page.goto("http://127.0.0.1:3100/#feed");
  const catalog = await (
    await page.request.get("http://127.0.0.1:3100/api/catalog")
  ).json();
  assert(catalog.data.items.length > 0);
  await page
    .getByRole("button", { name: catalog.data.items[0].name, exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", {
        name: "مشاهده کاتالوگ متصل به دیتابیس",
        exact: true,
      })
      .count(),
    0,
  );
  const text = "integration-comment-" + Date.now();
  const input = page
    .getByPlaceholder("پرسش یا دیدگاه درباره این کالا بنویسید...")
    .first();
  await input.fill(text);
  const denied = page.waitForResponse(
    (r) => r.url().includes("/comments") && r.request().method() === "POST",
  );
  await page.locator("main article").first().locator("form button").click();
  assert.equal((await denied).status(), 401);
  assert.equal(await input.inputValue(), text, "failed comment retains input");
  await page.goto("http://127.0.0.1:3100/#account");
  await page
    .getByRole("button", { name: "ورود آزمایشی محلی؛ بدون تأیید شماره" })
    .click();
  await page
    .getByRole("button", { name: "خروج از حساب", exact: true })
    .waitFor();
  await page.goto("http://127.0.0.1:3100/#feed");
  await page.locator("main article").first().waitFor();
  const commentInput = page
    .getByPlaceholder("پرسش یا دیدگاه درباره این کالا بنویسید...")
    .first();
  await commentInput.fill(text);
  const accepted = page.waitForResponse(
    (r) => r.url().includes("/comments") && r.request().method() === "POST",
  );
  await page.locator("main article").first().locator("form button").click();
  assert.equal((await accepted).status(), 201);
  await page.getByText(text, { exact: true }).first().waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: catalog.data.items[0].name, exact: true })
    .first()
    .click();
  await page.getByRole("dialog").getByText(text, { exact: true }).waitFor();
  const rows = await (
    await page.request.get(
      "http://127.0.0.1:3100/api/posts/" +
        catalog.data.items[0].id +
        "/comments",
    )
  ).json();
  const created = rows.data.items.find((c) => c.text === text);
  assert(created);
  assert.equal(
    (
      await page.request.delete(
        "http://127.0.0.1:3100/api/comments/" + created.id,
        { headers: { origin: "http://127.0.0.1:3100" } },
      )
    ).status(),
    200,
  );
  await page.goto("http://127.0.0.1:3100/#account");
  await page.getByRole("button", { name: "خروج از حساب", exact: true }).click();
  await page
    .getByRole("button", { name: "ورود آزمایشی محلی؛ بدون تأیید شماره" })
    .waitFor();
  await page.getByRole("button", { name: "سبد خرید", exact: true }).click();
  await page
    .getByRole("dialog", { name: "سبد سروری", exact: true })
    .getByRole("alert")
    .waitFor();
  await page.getByRole("button", { name: "بستن سبد", exact: true }).click();
  await page.goto("http://127.0.0.1:3100/admin");
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("MFA") ||
      document.body.innerText.includes("ورود"),
  );
  await page.goto("http://127.0.0.1:3100/#feed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3100/#feed");
  await page
    .getByRole("heading", { name: "فید زنده کیا — هر روز جدید، بدون واسطه" })
    .waitFor();
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  assert(
    width.scroll <= width.viewport,
    "mobile overflow: " + JSON.stringify(width),
  );
  assert.deepEqual(errors, [], "browser runtime errors");
  console.log(
    "PASS: exact-template feed, seven routes, reload, search empty state, main-feed database DTO, real demo session/logout, comment auth/persistence/deletion, secure admin, cart access, mobile overflow and browser error checks.",
  );
} finally {
  await browser.close();
}
