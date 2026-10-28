import Link from "next/link";
import {
  Instagram,
  Send,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { infoPages, site } from "@/lib/site";
import "./site-footer.css";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <section className="site-footer-brand">
          <span className="eyebrow">
            {site.nameEn} / {site.domain}
          </span>
          <h2>
            {site.name} — {site.tagline}
          </h2>
          <p>
            فروشگاه اجتماعی با انتخاب‌های کوچک و جزئیات دوست‌داشتنی؛ قیمت عمدهٔ
            همکاری فقط برای حساب تأییدشده نمایش داده می‌شود.
          </p>
          <div className="site-footer-social">
            <a
              href={site.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="اینستاگرام کیا"
            >
              <Instagram size={17} /> اینستاگرام
            </a>
            <a
              href={site.telegram}
              target="_blank"
              rel="noreferrer"
              aria-label="کانال تلگرام کیا"
            >
              <Send size={17} /> تلگرام
            </a>
            <a
              href={site.telegramBot}
              target="_blank"
              rel="noreferrer"
              aria-label="ربات تلگرام کیا"
            >
              <Send size={17} /> ربات پشتیبانی
            </a>
          </div>
        </section>
        <nav className="site-footer-links" aria-label="پیوندهای پاورقی">
          <div>
            <b>فروشگاه</b>
            <Link href="/">فید اصلی</Link>
            <Link href="/explore">اکسپلور و کاتالوگ</Link>
            <Link href="/wholesale">عمدهٔ جینی</Link>
            <Link href="/basket">سبد و سفارش‌ها</Link>
          </div>
          <div>
            <b>راهنما</b>
            {infoPages.map((p) => (
              <Link key={p.href} href={p.href}>
                {p.label}
              </Link>
            ))}
          </div>
          <div>
            <b>وضعیت پروژه</b>
            <Link href="/progress">نقشهٔ تکمیل</Link>
            <Link href="/admin/preview">نمایش مدیریت</Link>
            <Link href="/account">حساب مشتری</Link>
            <Link href="/inbox">راه‌های ارتباط</Link>
          </div>
        </nav>
      </div>
      <div className="site-footer-note">
        <span>
          <ShieldCheck size={15} /> پرداخت و ارسال هنوز فعال نشده‌اند؛ سفارش‌ها
          اولیه‌اند و وجهی دریافت نمی‌شود.
        </span>
        <span>
          <Sparkles size={15} /> {site.nameEn} — MADE FOR YOU
        </span>
        <Link href="/about">
          داستان کیا <ArrowLeft size={14} />
        </Link>
      </div>
    </footer>
  );
}
