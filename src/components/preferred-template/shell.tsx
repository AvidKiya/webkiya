"use client";
// Adapted from the owner's template, commit 2970536: Header/NavRail/BottomNav.
// Navigation, auth and commerce use the host app; no demo persona or payment state.
import Image from "next/image";
import Link from "next/link";
import {
  Bookmark,
  Compass,
  Home,
  Layers,
  MessageCircle,
  PackageCheck,
  Search,
  Shield,
  ShoppingBag,
  Sun,
  Moon,
  Store,
  UserRound,
  ArrowLeft,
  Send,
  Instagram,
  BookOpen,
} from "lucide-react";
import { faNumber } from "@/lib/catalog";
const items = [
  { href: "/", key: "home", label: "فید اصلی", icon: Home },
  {
    href: "/explore",
    key: "explore",
    label: "اکسپلور و فروشگاه",
    icon: Compass,
  },
  {
    href: "/wholesale",
    key: "wholesale",
    label: "عمده جینی و همکاری",
    icon: Layers,
  },
  { href: "/saved", key: "saved", label: "ذخیره‌شده‌ها", icon: Bookmark },
  { href: "/profile", key: "profile", label: "پروفایل فروشگاه", icon: Store },
  {
    href: "/inbox",
    key: "inbox",
    label: "گفت‌وگو با کیا",
    icon: MessageCircle,
  },
  {
    href: "/account",
    key: "account",
    label: "حساب و سفارش‌ها",
    icon: UserRound,
  },
];
export function TemplateHeader({
  theme,
  toggleTheme,
  query,
  setQuery,
  section,
  cartCount,
  inert,
}: {
  theme: string;
  toggleTheme: () => void;
  query: string;
  setQuery: (q: string) => void;
  section: string;
  cartCount: number;
  inert: boolean;
}) {
  const searchable = ["home", "explore", "saved", "wholesale"].includes(
    section,
  );
  return (
    <div className="template-header" inert={inert}>
      <div className="template-announcement">
        <div>
          <span>پیش‌نمایش کیا</span>
          <p>خرید تکی و عمدهٔ جینی · پرداخت و ارسال هنوز فعال نیست</p>
          <Link href="/progress">
            نقشهٔ تکمیل <ArrowLeft size={12} />
          </Link>
        </div>
      </div>
      <header className="template-topbar">
        <div className="template-header-inner">
          <Link
            href="/"
            className="template-brand"
            aria-label="کیا — صفحه اصلی"
          >
            <Image
              src={`/brand/logo-${theme === "dark" ? "dark" : "light"}.webp`}
              alt="کیا — KIYA"
              width={96}
              height={56}
              priority
            />
            <span>
              کیا، همراه انتخاب‌های تو<small>KIYA / kiyaco24.ir</small>
            </span>
          </Link>
          {searchable ? (
            <label className="template-search">
              <Search size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجو در انتخاب‌های کیا…"
                aria-label="جست‌وجوی سریع محصولات"
              />
            </label>
          ) : (
            <Link href="/explore" className="template-search-link">
              <Search size={18} /> کشف و جست‌وجو
            </Link>
          )}
          <div className="template-header-actions">
            <Link href="/wholesale" className="template-wholesale-link">
              <Layers size={16} /> همکاری عمده
            </Link>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label="تغییر حالت روشن و تیره"
              title={theme === "dark" ? "حالت روشن" : "حالت تیره"}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Link
              className="icon-button template-inbox-link"
              href="/inbox"
              aria-label="دایرکت و پشتیبانی"
            >
              <MessageCircle size={20} />
            </Link>
            <Link
              className="icon-button"
              href="/basket"
              aria-label="سبد سروری و سفارش‌های من"
            >
              <ShoppingBag size={20} />
            </Link>
            <Link
              className="template-admin-link"
              href="/admin"
              aria-label="ورود به پنل مدیریت"
            >
              <Shield size={17} />
              <span>پنل مدیریت</span>
            </Link>
          </div>
        </div>
      </header>
      <div className="template-tools">
        <Link href="/admin/preview" aria-label="نمایش مدیریت (فقط خواندنی)">
          دیدن مدیریت فقط‌خواندنی
        </Link>
        <Link href="/cart">
          سبد نمونه {cartCount ? `(${faNumber(cartCount)})` : ""}
        </Link>
        <Link href="/account">ورود مشتری</Link>
        <Link href="/basket">سبد و سفارش سروری</Link>
      </div>
    </div>
  );
}
export function TemplateNavigation({
  section,
  theme,
  toggleTheme,
  inert,
}: {
  section: string;
  theme: string;
  toggleTheme: () => void;
  inert: boolean;
}) {
  return (
    <aside className="sidebar template-nav" inert={inert}>
      <nav aria-label="منوی اصلی">
        <p className="nav-label">ناوبری فروشگاه</p>
        {items.map(({ href, key, label, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            title={label}
            aria-label={label}
            aria-current={section === key ? "page" : undefined}
            className={`nav-link ${section === key ? "active" : ""} ${key === "wholesale" ? "template-partner-nav" : ""}`}
          >
            <Icon size={20} />
            <span>{label}</span>
            {key === "wholesale" ? <small>۱ جین</small> : null}
          </Link>
        ))}
        <Link
          className="nav-link"
          href="/basket"
          title="سبد و سفارش سروری"
          aria-label="سبد و سفارش سروری"
        >
          <PackageCheck size={20} />
          <span>سبد و سفارش سروری</span>
        </Link>
        <button
          className="nav-link template-theme"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "حالت روشن" : "حالت تیره"}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          <span>{theme === "dark" ? "حالت روشن" : "حالت تیره"}</span>
        </button>
      </nav>
      <section className="template-mini-profile">
        <Image src="/brand/profile.webp" alt="" width={40} height={40} />
        <div>
          <b>کیا — KIYA</b>
          <small>@kiyaco24 · خرید تکی و عمده</small>
        </div>
        <p>
          انتخاب‌های متنوع، تجربه‌ای ساده؛ قیمت همکاری فقط برای همکار تأییدشده.
        </p>
        <div className="template-social">
          <a
            href="https://www.instagram.com/kiyaco24/"
            target="_blank"
            rel="noreferrer"
            aria-label="اینستاگرام کیا"
          >
            <Instagram size={17} />
          </a>
          <a
            href="https://t.me/kiyaco24"
            target="_blank"
            rel="noreferrer"
            aria-label="کانال تلگرام کیا"
          >
            <Send size={17} />
          </a>
          <Link href="/progress">مسیر توسعه</Link>
        </div>
      </section>
    </aside>
  );
}
export function TemplateBottomNav({
  section,
  inert,
}: {
  section: string;
  inert: boolean;
}) {
  const mobile = [
    items[0],
    items[1],
    { href: "/basket", key: "basket", label: "سبد و سفارش", icon: ShoppingBag },
    items[3],
    items[6],
  ];
  return (
    <nav
      className="mobile-nav template-bottom"
      aria-label="ناوبری موبایل"
      inert={inert}
    >
      {mobile.map(({ href, key, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={section === key ? "page" : undefined}
          className={`${section === key ? "active" : ""} ${key === "basket" ? "template-bottom-cart" : ""}`}
        >
          <Icon size={21} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
export function TemplateServiceCard() {
  return (
    <section className="template-service-card surface">
      <h2>مسیر خرید در کیا</h2>
      <Link href="/basket">
        <PackageCheck size={18} />
        <span>
          سبد و سفارش‌های من<small>رزرو کوتاه‌مدت، بدون پرداخت</small>
        </span>
        <ArrowLeft size={15} />
      </Link>
      <Link href="/wholesale">
        <Layers size={18} />
        <span>
          پورتال همکاران<small>حداقل یک جین؛ قیمت خصوصی</small>
        </span>
        <ArrowLeft size={15} />
      </Link>
      <Link href="/profile">
        <BookOpen size={18} />
        <span>
          دربارهٔ کیا و راه‌های ارتباط<small>وضعیت ارسال و قوانین شفاف</small>
        </span>
        <ArrowLeft size={15} />
      </Link>
    </section>
  );
}

export function TemplateWholesaleInsert() {
  return (
    <section className="template-feed-insert">
      <div>
        <span>
          <Layers size={14} /> ویژهٔ همکاران
        </span>
        <h2>خرید عمده جینی؛ شروع از یک جین</h2>
        <p>ترکیب واقعی هر بسته · قیمت خصوصی · بدون حداقل مبلغ اضافه</p>
      </div>
      <Link href="/wholesale">
        ورود به بخش عمده <ArrowLeft size={15} />
      </Link>
    </section>
  );
}
