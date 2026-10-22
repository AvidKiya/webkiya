import Link from "next/link";
import { deliveryMap, deliveryLabels } from "@/lib/delivery-map";
import "./progress.css";
export const metadata = { title: "نقشهٔ تکمیل پروژه — کیا" };
export default function Progress() {
  return (
    <main id="main" className="delivery-page">
      <header>
        <span className="delivery-eyebrow">
          KIYA / DELIVERY MAP · 2026-10-22
        </span>
        <h1>کیا؛ چه چیزهایی آماده است و چه چیزهایی مانده؟</h1>
        <p>
          نقشهٔ دستی و نسخه‌دارِ تحویل، نه داشبورد زندهٔ اطلاعات فروشگاه. درصد
          حدسی نمی‌دهیم؛ «پیاده و تست شده» فقط به محدودهٔ نوشته‌شدهٔ همان بخش
          اشاره دارد، نه تکمیل تمام FULL.
        </p>
        <nav aria-label="مسیرهای پروژه">
          <Link href="/">ویترین فروشگاه</Link>
          <Link href="/admin">ورود به مدیریت واقعی</Link>
          <Link href="/admin/preview">دیدن مدیریت فقط‌خواندنی</Link>
        </nav>
      </header>
      <section className="delivery-focus">
        <h2>مسیر اصلی تا فروش واقعی</h2>
        <p>
          کاتالوگ و موجودی ← جین واقعی ← قیمت خصوصی عمده ← سبد و quote سروری ←
          رزرو ← سفارش ← پرداخت و ارسال ← ممیزی و انتشار.
        </p>
        <strong>
          اکنون: تعریف واقعی جین ساخته شده؛ اتصال به قیمت و سفارش هنوز باقی است.
        </strong>
        <p>
          کارهایی که به سرویس خارجی وابسته نیستند می‌توانند ادامه یابند. قیمت،
          موجودی، ترکیب جین و سیاست‌های فروش واقعی را حدس نمی‌زنیم.
        </p>
      </section>
      <div className="delivery-legend">
        {Object.entries(deliveryLabels).map(([key, label]) => (
          <span key={key} data-state={key}>
            {label}
          </span>
        ))}
      </div>
      <section className="delivery-grid" aria-label="وضعیت بخش‌ها">
        {deliveryMap.map((item) => (
          <article key={item.id} id={"step-" + item.id}>
            <div className="delivery-card-top">
              <b>مسیر {item.id}</b>
              <span data-state={item.state}>{deliveryLabels[item.state]}</span>
            </div>
            <h2>{item.title}</h2>
            <h3>آنچه داریم</h3>
            <p>{item.done}</p>
            <h3>آنچه مانده</h3>
            <p>{item.remaining}</p>
            <h3>شرط تکمیل / نیاز به بررسی</h3>
            <p>{item.gate}</p>
          </article>
        ))}
      </section>
      <section className="delivery-focus">
        <h2>اطلاعات و تصمیم‌هایی که از مالک لازم می‌شود</h2>
        <ul>
          <li>مشخصات، عکس، موجودی، ترکیب رنگ/سایز جین و قیمت واقعی کالاها.</li>
          <li>سیاست قیمت عمده و تخصیص لیست قیمت به همکارها.</li>
          <li>قواعد ارسال، مرجوعی، ضمانت، مالیات و تأیید متن‌های حقوقی.</li>
          <li>
            انتخاب سرویس OTP و پرداخت و زیرساخت دامنه؛ اسرار فقط در محل امن
            تنظیم شوند.
          </li>
        </ul>
        <p>
          برای شروع ساخت بخش‌های مستقل نیازی به پاسخ همهٔ این‌ها نیست. اما بدون
          داده و تأیید لازم، آن بخش را «آمادهٔ فروش» علامت نمی‌زنیم.
        </p>
      </section>
      <footer>
        مرجع جزئی‌تر داخل مخزن: file/docs/26-delivery-map.md و گزارش‌های
        مرحله‌ای. سفارش، پرداخت و ورود پیامکی واقعی هنوز فعال نیستند.
      </footer>
    </main>
  );
}
