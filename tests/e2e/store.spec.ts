import { test, expect } from "@playwright/test";
test("desktop: shared server comments, reload, reply, saved and local cart", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "هر روز، یک کشف تازه." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "مشاهدهٔ کیف دستی و دوشی چرم", exact: true })
    .click();
  await expect(page).toHaveURL(/\/p\/everyday-bag/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
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
  await expect(page.getByText(text, { exact: true })).toBeVisible();
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
  await page
    .locator(".comment-thread")
    .filter({ hasText: text })
    .getByRole("button", { name: "پاسخ", exact: true })
    .click();
  await page.getByLabel("دیدگاه شما").fill("پاسخ نمونه " + text);
  await page.getByRole("button", { name: "ارسال دیدگاه", exact: true }).click();
  await expect(
    page.getByText("پاسخ نمونه " + text, { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const first = page.locator("article.post").first();
  await first.getByRole("button", { name: "ذخیره کردن", exact: true }).click();
  await first
    .getByRole("button", { name: "افزودن به سبد", exact: true })
    .click();
  await page
    .getByRole("link", { name: "ذخیره‌شده‌ها", exact: true })
    .first()
    .click();
  await expect(page.locator("article.post")).toHaveCount(1);
  await page.goto("/cart");
  await expect(page.getByText("جمع سبد نمونه").first()).toBeVisible();
  await expect(page.getByText("۱٬۴۵۰٬۰۰۰").first()).toBeVisible();
  expect(errors).toEqual([]);
});
test("filter and expand caption; wholesale remains inquiry only", async ({
  page,
}) => {
  await page.goto("/");
  const first = page.locator("article.post").first();
  await first.getByRole("button", { name: "بیشتر بخون" }).click();
  await expect(
    first.getByRole("button", { name: "کمتر", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("جست‌وجوی محصولات").fill("ساعت");
  await expect(page.locator("article.post")).toHaveCount(1);
  await page.getByRole("button", { name: "عمده", exact: true }).click();
  await expect(page.getByText("استعلام قیمت عمده").first()).toBeVisible();
  await page
    .locator("article.post")
    .getByRole("button", { name: "استعلام عمده" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("شروع همکاری، از یک جین.")).toBeVisible();
});
test("mobile has no horizontal overflow, stories and saved empty state work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("navigation", { name: "ناوبری موبایل" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "تازه رسیدن", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "دیدن این مجموعه" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "ناوبری موبایل" })
    .getByRole("link", { name: "ذخیره‌شده‌ها" })
    .click();
  await expect(
    page.getByRole("heading", { name: "هنوز چیزی ذخیره نکردی" }),
  ).toBeVisible();
});
test("unknown route is 404 and dark mode toggles", async ({ page }) => {
  const response = await page.goto("/missing");
  expect(response?.status()).toBe(404);
  await page.goto("/");
  await page.getByRole("button", { name: "حالت تیره", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("delivery map explains done, remaining and owner-dependent work without private APIs", async ({
  page,
}) => {
  const privateCalls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/admin/"))
      privateCalls.push(r.url());
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
