"use client";

import Link from "next/link";
import {
  BadgeCheck,
  MessageCircle,
  Send,
  Instagram,
  MapPin,
  Clock,
  Layers,
  Sparkles,
  ArrowLeft,
  PackageCheck,
  ShieldCheck,
  Bot,
  BookOpen,
  Info,
  ShoppingBag,
  Boxes,
  Wallet,
} from "lucide-react";
import { AccountPanel, PartnerPanel } from "@/components/account-panel";
import { useAccount } from "@/lib/api";
import { OrderHistory } from "@/components/order-history";
import { ServerBasket } from "@/components/server-basket";
import { WholesaleCatalog } from "@/components/wholesale-catalog";
import { brandProfile } from "./brand";
import { useKiya } from "./context";
import { ProductTile, KiyaSaved } from "./feed";
import { formatNumber } from "./kit";

export { KiyaSaved };

export function KiyaProfile() {
  const { products } = useKiya();

  return (
    <div className="w-full max-w-[920px] mx-auto space-y-5">
      <div className="bg-surface rounded-3xl border border-border shadow-e1 overflow-hidden">
        <div className="h-32 md:h-40 bg-gradient-to-l from-[#482780] via-[#381C68] to-[#1D0E36] relative flex items-center justify-end px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-dark.webp"
            alt="کیا — KIYA"
            className="h-20 md:h-24 object-contain opacity-90"
          />
        </div>

        <div className="px-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 relative z-10">
            <div className="flex items-end gap-3.5">
              <div className="w-22 h-22 md:w-24 md:h-24 rounded-full overflow-hidden ring-4 ring-surface bg-[#482780] shadow-e2 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandProfile}
                  alt="کیا"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg md:text-xl font-black text-ink-900">
                    کیا — KIYA
                  </h1>
                  <BadgeCheck className="w-5 h-5 text-brand-500" />
                </div>
                <p className="text-xs text-ink-500 font-mono">
                  <bdi>@kiyaco24 · kiyaco24.ir</bdi>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/inbox"
                className="px-4 py-2 rounded-xl bg-buy text-buy-fg text-xs font-extrabold flex items-center gap-1.5 shadow-e1"
              >
                <MessageCircle className="w-4 h-4" />
                <span>پیام به پشتیبانی</span>
              </Link>
              <a
                href="https://t.me/kiyaco24"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-canvas-sunken hover:bg-brand-50 border border-border text-ink-800 text-xs font-bold flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-brand-500" />
                <span>کانال تلگرام</span>
              </a>
            </div>
          </div>

          <p className="text-xs md:text-sm text-ink-700 leading-relaxed mt-4 max-w-2xl">
            هر روز جدید، بدون واسطه · عرضهٔ تخصصی کیف و کیف پول، کفش، کمربند،
            لباس زیر (پلمب بهداشتی)، اکسسوری شخصی، گارد موبایل و هدیهٔ شخصی به
            صورت تکی و عمدهٔ جینی همکاران.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-2xl bg-canvas-sunken text-center">
            <div>
              <span className="text-sm md:text-base font-black text-ink-900 block">
                {formatNumber(products.length)}
              </span>
              <span className="text-[11px] text-ink-500">کالای منتشرشده</span>
            </div>
            <div>
              <span className="text-sm md:text-base font-black text-ink-900 block">
                {formatNumber(new Set(products.map((p) => p.category)).size)}
              </span>
              <span className="text-[11px] text-ink-500">دستهٔ فعال</span>
            </div>
            <div>
              <span className="text-sm md:text-base font-black text-ink-900 block">
                ۱ جین
              </span>
              <span className="text-[11px] text-ink-500">حداقل خرید عمده</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 text-[11px] text-ink-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              ارسال از تهران
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              پاسخ‌گویی در ساعات کاری
            </span>
            <a
              href="https://www.instagram.com/kiyaco24/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-brand-500"
            >
              <Instagram className="w-3.5 h-3.5" />
              اینستاگرام
            </a>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-3xl border border-border shadow-e1 p-5 space-y-3">
        <h2 className="font-extrabold text-sm text-ink-900 flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4 text-brand-500" />
          ویترین کالاها
        </h2>
        {products.length === 0 ? (
          <p className="text-xs text-ink-500">هنوز کالایی منتشر نشده است.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products.slice(0, 6).map((product) => (
              <ProductTile key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function KiyaInbox() {
  const channels = [
    {
      icon: Send,
      title: "کانال تلگرام کیا",
      desc: "اطلاع‌رسانی دراپ‌ها، شارژ موجودی و شرایط عمده",
      href: "https://t.me/kiyaco24",
      label: "@kiyaco24",
    },
    {
      icon: Bot,
      title: "ربات پشتیبانی",
      desc: "پیگیری سفارش و پرسش‌های پرتکرار",
      href: "https://t.me/kiyaco24bot",
      label: "@kiyaco24bot",
    },
    {
      icon: Instagram,
      title: "اینستاگرام",
      desc: "استایل‌بوک و پشت‌صحنهٔ کالکشن‌ها",
      href: "https://www.instagram.com/kiyaco24/",
      label: "@kiyaco24",
    },
  ];

  return (
    <div className="w-full max-w-[760px] mx-auto space-y-4">
      <div className="bg-surface rounded-3xl border border-border shadow-e1 p-6 space-y-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-50 text-brand-500 border border-brand-200">
          <Sparkles className="w-3 h-3" />
          پشتیبانی کیا
        </span>
        <h1 className="text-lg font-black text-ink-900">
          گفت‌وگو با کیا، بدون واسطه
        </h1>
        <p className="text-xs text-ink-600 leading-relaxed">
          چت داخل سایت هنوز فعال نشده است؛ برای اینکه چیزی از دست نرود،
          کانال‌های رسمی زیر فعال‌اند و پاسخ‌گویی در ساعات کاری انجام می‌شود.
        </p>
      </div>

      <div className="grid gap-3">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <a
              key={channel.title}
              href={channel.href}
              target="_blank"
              rel="noreferrer"
              className="bg-surface rounded-2xl border border-border shadow-e1 p-4 flex items-center gap-3 hover:border-brand-300 transition-colors"
            >
              <span className="w-11 h-11 rounded-2xl bg-buy text-buy-fg flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-ink-900">
                  {channel.title}
                </span>
                <span className="block text-[11px] text-ink-500">
                  {channel.desc}
                </span>
              </span>
              <span
                className="text-[11px] font-bold text-brand-500 shrink-0"
                dir="ltr"
              >
                {channel.label}
              </span>
            </a>
          );
        })}
      </div>

      <div className="bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-2">
        <h2 className="font-extrabold text-sm text-ink-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-brand-500" />
          پیش از سفارش بخوان
        </h2>
        <ul className="text-xs text-ink-600 leading-relaxed space-y-1 list-disc pr-4">
          <li>پرداخت آنلاین و پیامک ورود هنوز فعال نیستند.</li>
          <li>قیمت‌ها و مشخصات کاتالوگ فعلی نمونهٔ آزمایشی هستند.</li>
          <li>شرایط ارسال و بازگشت کالا در صفحات اطلاعاتی آمده است.</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/shipping"
            className="px-3 py-1.5 rounded-xl bg-canvas-sunken text-ink-700 text-[11px] font-bold border border-border"
          >
            شرایط ارسال
          </Link>
          <Link
            href="/faq"
            className="px-3 py-1.5 rounded-xl bg-canvas-sunken text-ink-700 text-[11px] font-bold border border-border"
          >
            پرسش‌های متداول
          </Link>
          <Link
            href="/contact"
            className="px-3 py-1.5 rounded-xl bg-canvas-sunken text-ink-700 text-[11px] font-bold border border-border"
          >
            تماس با کیا
          </Link>
        </div>
      </div>
    </div>
  );
}

export function KiyaMag() {
  const { products } = useKiya();
  const categories = [...new Set(products.map((product) => product.category))];

  return (
    <div className="w-full max-w-[860px] mx-auto space-y-4">
      <div className="bg-surface rounded-3xl border border-border shadow-e1 p-6 space-y-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gold-400/25 text-gold-text border border-gold-500/30">
          <BookOpen className="w-3 h-3" />
          KIYA MAG
        </span>
        <h1 className="text-lg font-black text-ink-900">
          مجلهٔ کیامگ — راهنمای انتخاب
        </h1>
        <p className="text-xs text-ink-600 leading-relaxed">
          راهنمای خرید، نگهداری و ست‌کردن کالاها. محتوای تحریریه در حال
          آماده‌سازی است؛ تا آن زمان از میان دسته‌های فروشگاه شروع کن.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {[
          {
            title: "چطور کیف چرم را سال‌ها نو نگه داریم؟",
            tag: "نگهداری",
          },
          {
            title: "راهنمای انتخاب سایز کمربند بدون متر",
            tag: "راهنمای سایز",
          },
          {
            title: "ست‌کردن ساعت و دستبند با استایل روزمره",
            tag: "استایل",
          },
          {
            title: "خرید عمده جینی برای فروشگاه تازه‌کار",
            tag: "همکاری",
          },
        ].map((article) => (
          <div
            key={article.title}
            className="bg-surface rounded-2xl border border-border shadow-e1 p-4 space-y-1.5"
          >
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-50 text-brand-500">
              {article.tag}
            </span>
            <h2 className="text-sm font-extrabold text-ink-900 leading-snug">
              {article.title}
            </h2>
            <p className="text-[11px] text-ink-500">
              پیش‌نویس تحریریه — به‌زودی منتشر می‌شود.
            </p>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-3">
        <h2 className="font-extrabold text-sm text-ink-900">
          شروع از دسته‌های فروشگاه
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <Link
              key={category}
              href={`/explore?category=${encodeURIComponent(category)}`}
              className="px-3 py-1.5 rounded-xl bg-canvas-sunken border border-border text-xs font-bold text-ink-700 hover:bg-brand-50"
            >
              {category}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KiyaWholesale() {
  const steps = [
    {
      icon: PackageCheck,
      title: "۱ جین هم حداقل سفارش است",
      desc: "بدون سقف یا حداقل مبلغ اضافه؛ هر جین ترکیب مشخص سایز و رنگ دارد.",
    },
    {
      icon: ShieldCheck,
      title: "تأیید حساب همکاری",
      desc: "پس از ثبت درخواست و بررسی، قیمت واحد عمده برای حساب شما باز می‌شود.",
    },
    {
      icon: Boxes,
      title: "شفافیت کامل بسته",
      desc: "ترکیب دقیق هر جین، تعداد واحد و قیمت هر بسته روی پورتال می‌آید.",
    },
    {
      icon: Wallet,
      title: "فاکتور شفاف",
      desc: "جمع فاکتور عمده پیش از ثبت سفارش نمایش داده می‌شود.",
    },
  ];

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-4">
      <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-[#482780] via-[#381C68] to-[#211A2B] text-white shadow-e2 space-y-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gold-500 text-[#211A2B]">
          <Layers className="w-3 h-3" />
          پورتال همکاران کیا
        </span>
        <h1 className="text-xl md:text-2xl font-black leading-snug">
          فقط مشتری نباش، همکار کیا باش.
        </h1>
        <p className="text-xs md:text-sm text-white/85 leading-relaxed max-w-2xl">
          اگر صاحب فروشگاه یا پیج هستی، با تأیید حساب همکاری قیمت واحد عمده و
          ترکیب دقیق جین هر کالا برایت باز می‌شود. قیمت همکار هرگز در صفحات
          عمومی نمایش داده نمی‌شود.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/inbox"
            className="px-4 py-2 rounded-xl bg-gold-500 text-[#211A2B] font-extrabold text-xs flex items-center gap-1.5"
          >
            <span>درخواست همکاری</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/shipping"
            className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs"
          >
            شرایط ارسال عمده
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="bg-surface rounded-2xl border border-border shadow-e1 p-4 flex items-start gap-3"
            >
              <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-extrabold text-ink-900">
                  {step.title}
                </p>
                <p className="text-[11px] text-ink-500 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <section className="bg-surface rounded-2xl border border-border shadow-e1 p-5 space-y-3">
        <h2 className="font-extrabold text-sm text-ink-900">
          قیمت اختصاصی همکار (سروری)
        </h2>
        <p className="text-[11px] text-ink-500 leading-relaxed">
          این بخش از پایگاه داده خوانده می‌شود؛ قیمت عمده فقط برای حساب مشتری با
          همکاری معتبر نمایش داده می‌شود.
        </p>
        <WholesaleCatalog />
      </section>

      <section className="bg-surface rounded-2xl border border-border shadow-e1 p-5 space-y-3">
        <h2 className="font-extrabold text-sm text-ink-900">
          ثبت درخواست همکاری
        </h2>
        <PartnerPanel />
      </section>
    </div>
  );
}

export function KiyaAccount() {
  const { account } = useAccount();
  const signedIn = Boolean(account?.user);
  return (
    <div className="w-full max-w-[820px] mx-auto space-y-4">
      <div className="bg-surface rounded-3xl border border-border shadow-e1 p-5 space-y-3">
        <h1 className="font-black text-lg text-ink-900">حساب من</h1>
        <p className="text-xs text-ink-500">
          ورود پیامکی واقعی هنوز فعال نیست؛ نشست آزمایشی سروری برای بررسی جریان
          سفارش استفاده می‌شود.
        </p>
        <AccountPanel />
      </div>

      <div className="bg-surface rounded-3xl border border-border shadow-e1 p-5 space-y-3">
        <h2 className="font-extrabold text-sm text-ink-900 flex items-center gap-1.5">
          <PackageCheck className="w-4 h-4 text-brand-500" />
          سفارش‌های من
        </h2>
        <p className="text-[11px] text-ink-500">
          سفارش‌های ثبت‌شده روی حساب شما، همراه با وضعیت و مهلت رزرو.
        </p>
        <OrderHistory nonce={0} />
      </div>

      <section className="bg-surface rounded-3xl border border-border shadow-e1 p-5 space-y-3">
        <h2 className="font-extrabold text-sm text-ink-900 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-brand-500" />
          درخواست همکاری عمده
        </h2>
        {!signedIn && (
          <p className="text-[11px] text-ink-500">
            پس از ورود به حساب، فرم ثبت درخواست همکاری همین‌جا باز می‌شود.
          </p>
        )}
        <p className="text-[11px] text-ink-500 leading-relaxed">
          برای دیدن قیمت عمده و خرید جینی، ابتدا حساب همکاری خود را ثبت کنید؛
          تأیید درخواست توسط تیم کیا انجام می‌شود.
        </p>
        {signedIn && <PartnerPanel />}
      </section>

      <div className="bg-surface rounded-2xl border border-border p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-ink-600">
          سبد رسمی و بررسی قیمت در صفحهٔ سبد سروری است.
        </span>
        <div className="flex gap-2">
          <Link
            href="/basket"
            className="px-3 py-1.5 rounded-xl bg-buy text-buy-fg text-[11px] font-bold"
          >
            سبد سروری
          </Link>
          <Link
            href="/saved"
            className="px-3 py-1.5 rounded-xl bg-canvas-sunken text-ink-700 text-[11px] font-bold border border-border"
          >
            ذخیره‌شده‌ها
          </Link>
        </div>
      </div>
    </div>
  );
}

export function KiyaBasket() {
  return (
    <div className="w-full max-w-[900px] mx-auto space-y-4">
      <div className="bg-surface rounded-3xl border border-border shadow-e1 p-5 space-y-3">
        <h1 className="text-lg font-black text-ink-900">سبد سروری</h1>
        <p className="text-xs text-ink-500 leading-relaxed">
          سبد رسمی روی حساب مشتری در پایگاه داده ذخیره می‌شود؛ محاسبهٔ قیمت،
          رزرو موجودی و ثبت سفارش هنوز فعال نیست.
        </p>
        <ServerBasket />
      </div>
    </div>
  );
}
