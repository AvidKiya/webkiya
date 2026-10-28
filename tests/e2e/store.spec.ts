import { test, expect } from "@playwright/test";

test("desktop: feed, detail dialog, shared server comments, save and preview cart", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "فید زنده کیا — هر روز جدید، بدون واسطه",
    }),
  ).toBeVisible();

  const card = page.locator(".post-card").first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "مشخصات کامل" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/p\/everyday-bag$/);
  await dialog
    .getByRole("button", { name: "ورود آزمایشی", exact: true })
    .click();

  const text = "آزمون عمومی کیا " + Date.now();
  await dialog.getByLabel("دیدگاه شما").fill(text);
  await dialog
    .getByRole("button", { name: "ارسال دیدگاه", exact: true })
    .click();
  await expect(dialog.getByText(text, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(text, { exact: true })).toBeVisible({
    timeout: 40_000,
  });

  const observer = await browser.newContext();
  const observerPage = await observer.newPage();
  await observerPage.goto("/p/everyday-bag");
  await expect(observerPage.getByText(text, { exact: true })).toBeVisible();
  await expect(
    observerPage
      .locator(".comment-thread")
      .filter({ hasText: text })
      .getByRole("button", { name: "حذف", exact: true }),
  ).toHaveCount(0);
  await observer.close();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "ذخیره کالا", exact: true })
    .click();
  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "افزودن به سبد", exact: true })
    .click();
  await expect(page.getByText("به سبد پیش‌نمایش اضافه شد")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "سبد خرید", exact: true }).first(),
  ).toContainText("۱");

  await page
    .getByRole("link", { name: "ذخیره‌شده‌ها", exact: true })
    .first()
    .click();
  await expect(page.locator("[data-product-tile]")).toHaveCount(1);

  await page.goto("/");
  await page.getByRole("button", { name: "سبد خرید" }).first().click();
  await expect(page.getByRole("dialog", { name: "سبد خرید" })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "سبد خرید" }).getByText("جمع کالاها:"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("search filters the catalog and detail copy stays honest", async ({
  page,
}) => {
  await page.goto("/explore?q=ساعت");
  await expect(page.locator("[data-product-tile]")).toHaveCount(1);

  await page.goto("/explore");
  await page.getByLabel("جست‌وجوی محصولات").fill("نتیجه‌غیرموجودآزمون");
  await expect(page.locator("[data-product-tile]")).toHaveCount(0);
  await expect(page.getByText("کالایی پیدا نشد")).toBeVisible();

  await page.goto("/wholesale");
  await expect(
    page.getByText("قیمت همکار هرگز در صفحات عمومی نمایش داده نمی‌شود."),
  ).toBeVisible();
  await expect(page.getByText("پرداخت موفق")).toHaveCount(0);
});

test("mobile has no horizontal overflow, saved empty state and nav work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const nav = page.getByRole("navigation", { name: "ناوبری موبایل" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(4);
  await page.goto("/saved");
  await expect(
    page.getByText("هنوز چیزی ذخیره نکرده‌ای", { exact: true }),
  ).toBeVisible();
});

test("unknown route is 404 and dark mode toggles", async ({ page }) => {
  const response = await page.goto("/missing");
  expect(response?.status()).toBe(404);
  await page.goto("/");
  await page
    .getByRole("button", { name: "تغییر تم روشن و تیره", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("delivery map explains done, remaining and owner-dependent work without private APIs", async ({
  page,
}) => {
  const privateCalls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/admin/"))
      privateCalls.push(request.url());
  });
  const response = await page.goto("/progress");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      name: "کیا؛ چه چیزهایی آماده است و چه چیزهایی مانده؟",
    }),
  ).toBeVisible();
  await expect(page.locator(".delivery-grid article")).toHaveCount(16);
  await expect(
    page.getByText("قیمت خصوصی عمده", { exact: true }),
  ).toBeVisible();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(privateCalls).toEqual([]);
});

test("story rings open the ported viewer and can be closed safely", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await page
    .getByRole("button", { name: /^استوری / })
    .first()
    .click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "فریم بعدی", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "مکث", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "ادامه پخش", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("explore switches between shop grid and mosaic without overflow", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page.locator("[data-product-tile]").first()).toBeVisible();
  await page.getByRole("button", { name: "موزاییک", exact: true }).click();
  await expect(page.locator("[data-product-tile]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^کیف دستی و دوشی چرم$/ }).first(),
  ).toBeVisible();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "mosaic overflow at " + width,
    ).toBe(true);
  }
  await page.getByRole("button", { name: "فروشگاهی", exact: true }).click();
  await expect(page.locator("[data-product-tile]").first()).toBeVisible();
});

test("preview cart reaches the review step and states payment is not enabled", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".post-card")
    .first()
    .getByRole("button", { name: "افزودن به سبد", exact: true })
    .click();
  await page
    .getByRole("button", { name: "سبد خرید", exact: true })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "سبد خرید" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /ادامه و بررسی سفارش/ }).click();
  await expect(
    sheet.getByText(
      "پرداخت آنلاین هنوز فعال نیست؛ سفارش بدون پرداخت ثبت می‌شود.",
    ),
  ).toBeVisible();
  await expect(
    sheet.getByText(
      "هزینه و روش ارسال در مرحلهٔ بعد با پشتیبانی هماهنگ می‌شود.",
    ),
  ).toBeVisible();
  await expect(
    sheet.getByRole("link", { name: "رفتن به سبد سروری", exact: true }),
  ).toHaveAttribute("href", "/basket");
});

test("dark theme keeps template tokens readable on feed and catalog", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "تغییر تم روشن و تیره", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgb(20, 16, 24)");
  expect(
    await page
      .locator(".post-card")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(33, 26, 41)");
  await page.goto("/explore");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("[data-product-tile]").first()).toBeVisible();
  expect(
    await page
      .locator("[data-product-tile]")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(33, 26, 41)");
});
