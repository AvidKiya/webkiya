import { test, expect } from "@playwright/test";

test("owner template shell is the actual storefront without mock privilege or payment switches", async ({
  page,
}) => {
  const privateCalls: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  page.on("request", (request) => {
    if (
      /^\/api\/(admin|orders|wholesale)/.test(new URL(request.url()).pathname)
    )
      privateCalls.push(new URL(request.url()).pathname);
  });

  await page.goto("/");
  await expect(page.locator('[data-kiya-shell="v1"]')).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "ناوبری فروشگاه" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "همکار تأییدشده (عمده)", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /پرداخت موفق/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", {
      name: "فید زنده کیا — هر روز جدید، بدون واسطه",
    }),
  ).toBeVisible();

  await page
    .getByRole("searchbox", { name: "جست‌وجوی محصولات" })
    .fill("نتیجه‌غیرموجودآزمون");
  await page
    .getByRole("searchbox", { name: "جست‌وجوی محصولات" })
    .press("Enter");
  await expect(page).toHaveURL(/\/explore\?q=/);
  await expect(page.locator("[data-product-tile]")).toHaveCount(0);
  await expect(page.getByText("کالایی پیدا نشد")).toBeVisible();

  expect(privateCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test("store profile uses confirmed brand links and does not promise an unconfigured service", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/auth"))
      calls.push(request.url());
  });

  const response = await page.goto("/profile");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "کیا — KIYA", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator("main")).toContainText("هر روز جدید، بدون واسطه");
  await expect(page.locator("main")).toContainText("حداقل خرید عمده");
  await expect(
    page.locator("main").getByRole("link", { name: "اینستاگرام", exact: true }),
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
  await page
    .getByRole("button", { name: "تغییر تم روشن و تیره", exact: true })
    .click();
  await page.goto("/basket");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "ناوبری موبایل" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "حساب من" }).click();
  await expect(page).toHaveURL(/\/account$/);
});
