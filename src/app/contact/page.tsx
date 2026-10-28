import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/site-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "تماس و پشتیبانی — کیا",
  description:
    "راه‌های ارتباط رسمی با کیا: ربات تلگرام، کانال تلگرام و اینستاگرام؛ نکات امنیتی پیش از ارسال پیام.",
};

export default function ContactPage() {
  return (
    <InfoPage
      current="/contact"
      eyebrow="KIYA / SUPPORT"
      title="با کیا در تماس باش."
      lead="پشتیبانی کیا از مسیرهای رسمی انجام می‌شود. صندوق پیام داخل سایت هنوز راه‌اندازی نشده است؛ تا آن زمان از کانال‌های زیر استفاده کن."
    >
      <InfoSection title="کانال‌های رسمی">
        <div className="info-grid">
          <a
            className="info-card"
            href={site.telegramBot}
            target="_blank"
            rel="noreferrer"
          >
            <b>ربات تلگرام</b>
            <p>شروع گفت‌وگو، پیگیری سفارش و پرسش دربارهٔ همکاری.</p>
            <span dir="ltr">@kiyaco24bot</span>
          </a>
          <a
            className="info-card"
            href={site.telegram}
            target="_blank"
            rel="noreferrer"
          >
            <b>کانال تلگرام</b>
            <p>خبرها، مجموعه‌های تازه و اطلاع‌رسانی وضعیت فروشگاه.</p>
            <span dir="ltr">t.me/kiyaco24</span>
          </a>
          <a
            className="info-card"
            href={site.instagram}
            target="_blank"
            rel="noreferrer"
          >
            <b>اینستاگرام</b>
            <p>نگاه روزمره به انتخاب‌ها و پشت صحنهٔ کیا.</p>
            <span dir="ltr">@kiyaco24</span>
          </a>
        </div>
        <p className="micro">
          این صفحه شمارهٔ تلفن یا ایمیل جدیدی اعلام نمی‌کند؛ تا زمانی که مالک
          مسیر رسمی تازه‌ای تأیید نکند، فقط همین کانال‌ها معتبرند.
        </p>
      </InfoSection>
      <InfoSection title="پیش از ارسال پیام">
        <ul>
          <li>
            برای پیگیری سفارش، شناسهٔ سفارش و شمارهٔ همراه ثبت‌شده را بنویس؛
            شناسهٔ سفارش در <Link href="/basket">سبد و سفارش‌های من</Link> است.
          </li>
          <li>
            رمز عبور، کد دومرحله‌ای، کد بازیابی یا اطلاعات کارت بانکی را در پیام
            نفرست؛ پشتیبانی هرگز این موارد را نمی‌پرسد.
          </li>
          <li>
            حساب‌های آزمایشی (demo) دادهٔ واقعی ندارند؛ اگر تست می‌کنی از
            اطلاعات شخصی استفاده نکن.
          </li>
        </ul>
      </InfoSection>
      <InfoSection title="درخواست همکاری">
        <p>
          درخواست عمده از صفحهٔ <Link href="/wholesale">عمدهٔ جینی</Link> ثبت
          می‌شود و پس از بررسی، در حساب خودت وضعیت آن را می‌بینی. تأیید همکاری
          قیمت عمدهٔ ساختگی ایجاد نمی‌کند؛ قیمت فقط وقتی دیده می‌شود که لیست
          واقعی برای همان حساب منتشر شده باشد.
        </p>
      </InfoSection>
      <InfoSection title="زمان پاسخ‌گویی">
        <p>
          پیام‌ها به ترتیب دریافت بررسی می‌شوند؛ زمان پاسخ تضمین‌شده اعلام نشده
          است. برای موضوع‌های مالی یا حقوقی، مکالمهٔ مکتوب در کانال رسمی را نگه
          دار.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
