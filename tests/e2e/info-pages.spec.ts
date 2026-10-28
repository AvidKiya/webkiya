import { test, expect } from "@playwright/test";
const pages = [
  ["/about", "کیا؛ جزئیات کوچک، استایل تو."],
  ["/faq", "پرسش‌های رایج، پاسخ شفاف."],
  ["/shipping", "ارسال و مرجوعی؛ وضعیت واقعی."],
  ["/terms", "قوانین و شرایط؛ نسخهٔ پیش‌نویس."],
  ["/contact", "با کیا در تماس باش."],
] as const;
test("public information pages render, link each other and never call private APIs", async ({
  page,
}) => {
  const privateCalls: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/api/admin") || path.startsWith("/api/orders"))
      privateCalls.push(path);
  });
  for (const [path, heading] of pages) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(
      heading,
    );
    await expect(
      page.getByRole("navigation", { name: "صفحات اطلاعاتی" }),
    ).toBeVisible();
    await expect(page.locator(".site-footer")).toHaveCount(1);
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        path + " at " + width,
      ).toBe(true);
    }
  }
  await page
    .getByRole("navigation", { name: "صفحات اطلاعاتی" })
    .getByRole("link", { name: "سوالات متداول" })
    .click();
  await expect(page).toHaveURL(/\/faq$/);
  expect(privateCalls).toEqual([]);
});
test("store shell exposes the footer and keeps read-only storefront privacy", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.locator(".site-footer");
  await expect(footer).toHaveCount(1);
  await footer.scrollIntoViewIfNeeded();
  await expect(
    footer.getByRole("link", { name: "ارسال و مرجوعی" }),
  ).toBeVisible();
  await footer.getByRole("link", { name: "دربارهٔ کیا" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("main h1")).toHaveCount(1);
});
