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
  await page
    .getByRole("button", {
      name: "مشاهده کاتالوگ متصل به دیتابیس",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "کاتالوگ متصل به دیتابیس", exact: true })
    .waitFor();
  await page.waitForFunction(() =>
    document.querySelector(
      'section[aria-label="کاتالوگ متصل به دیتابیس"] article',
    ),
  );
  assert(
    (await page
      .locator('section[aria-label="کاتالوگ متصل به دیتابیس"] article')
      .count()) > 0,
    "real API catalog via proxy",
  );
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
    "PASS: exact-template feed, seven routes, reload, search empty state, real catalog API, mobile overflow and browser error checks.",
  );
} finally {
  await browser.close();
}
