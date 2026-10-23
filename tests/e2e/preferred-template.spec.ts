import { test, expect } from "@playwright/test";
test("selected owner template is the actual storefront without mock privilege or payment switches", async ({
  page,
}) => {
  const privateCalls: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^\/api\/(admin|orders|wholesale)/.test(new URL(r.url()).pathname))
      privateCalls.push(new URL(r.url()).pathname);
  });
  await page.goto("/");
  await expect(page.locator('[data-template="owner-2970536"]')).toHaveCount(1);
  await expect(page.locator(".template-header .template-brand")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "منوی اصلی" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "همکار تأییدشده (عمده)", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /پرداخت موفق/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("searchbox", { name: "جست‌وجوی سریع محصولات" })
    .fill("نتیجه‌غیرموجودآزمون");
  await expect(page.locator("article.post")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "جست‌وجوی سریع محصولات" }).fill("");
  await expect(page.locator("article.post").first()).toBeVisible();
  expect(privateCalls).toEqual([]);
  expect(errors).toEqual([]);
});
test("store profile uses confirmed brand links and does not promise an unconfigured service", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/auth")) calls.push(r.url());
  });
  const response = await page.goto("/profile");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      name: "کیا — همراه انتخاب‌های تو",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator("main")).toContainText(
    "قیمت عمده تنها پس از تأیید همکاری",
  );
  await expect(page.locator("main")).toContainText(
    "پرداخت و ارسال هنوز فعال نشده‌اند",
  );
  await expect(
    page
      .locator("main")
      .getByRole("link", { name: "اینستاگرام کیا", exact: true }),
  ).toHaveAttribute("href", "https://www.instagram.com/kiyaco24/");
  expect(calls).toEqual([]);
});
test("preferred shell stays responsive on profile, catalog and server basket in both themes", async ({
  page,
}) => {
  for (const path of ["/", "/profile", "/explore", "/wholesale", "/basket"]) {
    await page.goto(path);
    for (const width of [360, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          { message: path + " width " + width },
        )
        .toBe(true);
    }
  }
  await page.goto("/");
  await page.getByRole("button", { name: "حالت تیره", exact: true }).click();
  await page.goto("/basket");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "ناوبری موبایل" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "ناوبری موبایل" })
    .getByRole("link", { name: "حساب و سفارش‌ها" })
    .click();
  await expect(page).toHaveURL(/\/account$/);
});
