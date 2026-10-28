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
