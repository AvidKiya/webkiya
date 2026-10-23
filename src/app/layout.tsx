import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/800.css";
import "./globals.css";
import "./preferred-template.css";
export const metadata: Metadata = {
  title: "کیا — جزئیات کوچک، استایل تو",
  description: "پیش‌نمایش فروشگاه اجتماعی کیا؛ کشف استایل و اکسسوری شخصی",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth">
      <body>
        <a className="skip" href="#main">
          رفتن به محتوا
        </a>
        {children}
      </body>
    </html>
  );
}
