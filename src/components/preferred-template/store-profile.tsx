import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Layers, Instagram, Send, ShoppingBag } from "lucide-react";
// StoreProfileView presentation from the selected template, using confirmed brand facts only.
export function StoreProfile() {
  return (
    <div className="template-profile-page">
      <section className="surface template-profile-hero">
        <div className="template-profile-cover">
          <span>KIYA / EVERYDAY FINDS</span>
        </div>
        <div className="template-profile-info">
          <Image
            src="/brand/profile.webp"
            alt="کیا — KIYA"
            width={88}
            height={88}
          />
          <p dir="ltr">@kiyaco24</p>
          <h1>کیا — همراه انتخاب‌های تو</h1>
          <p>ویترین اجتماعی کیا؛ کشف کالا، خرید تکی و همکاری عمدهٔ جینی.</p>
          <div className="template-profile-actions">
            <Link className="primary" href="/explore">
              دیدن فروشگاه <ShoppingBag size={16} />
            </Link>
            <Link className="secondary" href="/wholesale">
              همکاری عمده <Layers size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="surface template-profile-details">
        <h2>یک ویترین، دو مسیر خرید</h2>
        <p>
          کالاها را در فید یا اکسپلور ببینید، توضیحات را باز کنید و از رنگ‌های
          ثبت‌شده انتخاب کنید. کالاهای واقعی به سبد سروری حساب مشتری اضافه
          می‌شوند؛ کالاهای نمونه صرفاً برای بررسی رابط‌اند.
        </p>
        <p>
          همکاری عمده از یک جین آغاز می‌شود. ترکیب هر جین به تعریف واقعی کالا
          بستگی دارد و الزاماً دوازده عدد نیست. قیمت عمده تنها پس از تأیید
          همکاری و تخصیص قیمت معتبر در حساب خود همکار نمایش داده می‌شود.
        </p>
        <Link href="/basket" className="text-link">
          سبد و سفارش‌های من <ArrowLeft size={16} />
        </Link>
      </section>
      <section className="surface template-profile-details">
        <h2>ارتباط با کیا</h2>
        <div className="template-profile-actions">
          <a
            className="secondary"
            href="https://www.instagram.com/kiyaco24/"
            target="_blank"
            rel="noreferrer"
          >
            <Instagram size={17} /> اینستاگرام کیا
          </a>
          <a
            className="secondary"
            href="https://t.me/kiyaco24"
            target="_blank"
            rel="noreferrer"
          >
            <Send size={17} /> کانال تلگرام کیا
          </a>
          <Link className="secondary" href="/inbox">
            راهنمای پشتیبانی
          </Link>
        </div>
        <p className="micro">
          این‌ها لینک‌های ارتباطی برند هستند؛ اتصال خودکار ربات یا دایرکت سایت
          هنوز فعال نیست.
        </p>
      </section>
      <section className="surface template-profile-details">
        <h2>وضعیت ارسال، ضمانت و قوانین</h2>
        <p>
          سفارش فعلی اولیه و همراه رزرو کوتاه‌مدت موجودی است؛ پرداخت و ارسال
          هنوز فعال نشده‌اند. روش و هزینهٔ ارسال، مالیات، شرایط ضمانت و مرجوعی
          پس از تأیید سیاست‌های واقعی فروشگاه منتشر می‌شوند. این صفحه وعدهٔ
          ارسال سریع یا ضمانت تأییدنشده نمی‌دهد.
        </p>
        <Link href="/progress" className="text-link">
          مشاهدهٔ نقشهٔ کامل توسعه <ArrowLeft size={16} />
        </Link>
      </section>
    </div>
  );
}
