"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  MessageCircle,
  UsersRound,
  Package,
  ClipboardList,
  ShieldCheck,
  ScrollText,
  ArrowUpLeft,
  RefreshCw,
  LogOut,
  LockKeyhole,
  KeyRound,
  Check,
  AlertCircle,
} from "lucide-react";
import { api, useAccount, authChanged } from "@/lib/api";
import { faNumber, money } from "@/lib/catalog";
import "./panel.css";
import { products } from "@/lib/catalog";
import { PartnerValidity } from "./wholesale-prices";
import { ProductWorkbench } from "./product-workbench";
import { DraftProductForm } from "./product-form";
import { AccessManagement, PasswordChange } from "./access-management";
import { OrderManager } from "./order-manager";
const tabs = [
  {
    id: "dashboard",
    label: "نمای کلی",
    icon: LayoutDashboard,
    permission: "dashboard:read",
  },
  {
    id: "orders",
    label: "سفارش‌ها و رزرو",
    icon: ClipboardList,
    permission: "order:read",
  },
  {
    id: "comments",
    label: "گفت‌وگوها",
    icon: MessageCircle,
    permission: "comment:read",
  },
  {
    id: "partners",
    label: "پروندهٔ همکاران",
    icon: UsersRound,
    permission: "partner:read",
  },
  {
    id: "products",
    label: "کاتالوگ",
    icon: Package,
    permission: "product:read",
  },
  {
    id: "staff",
    label: "تیم و دسترسی‌ها",
    icon: ShieldCheck,
    permission: "staff:read",
  },
  {
    id: "audit",
    label: "رویدادهای امنیتی",
    icon: ScrollText,
    permission: "audit:read",
  },
];
type Dashboard = {
  customers: number;
  comments: number;
  pending: number;
  products: number;
  openOrders: number;
  mode: string;
  paymentReady: boolean;
};
type Row = {
  id: string;
  status?: string;
  body?: string;
  postId?: string;
  businessName?: string;
  expiresAt?: string | null;
  city?: string;
  note?: string;
  version?: number;
  name?: string;
  price?: string;
  displayName?: string;
  isActive?: boolean;
  mfaEnabled?: boolean;
  action?: string;
  resourceId?: string | null;
  createdAt?: string;
  author?: { displayName: string; isDemo: boolean };
  user?: { displayName: string; isDemo: boolean };
  roles?: { role: { name: string; key: string } }[];
  mode?: string;
  subtotalToman?: string;
  reservedUntil?: string;
  endedAt?: string | null;
  expiry?: boolean;
  customer?: { displayName: string; isDemo: boolean; phone: string | null };
  lines?: {
    name: string;
    selection: string;
    quantity: number;
    totalUnits: number;
    lineTotalToman: string;
  }[];
};
export function AdminPanel({ preview = false }: { preview?: boolean }) {
  const router = useRouter();
  const {
    account: liveAccount,
    error: accountError,
    refresh,
  } = useAccount(!preview);
  const account = preview
    ? {
        user: {
          id: "visual-preview",
          name: "بازدیدکنندهٔ نمایش مدیریت",
          kind: "STAFF",
          isDemo: true,
          mfaEnabled: true,
          mfaVerified: true,
          permissions: tabs.map((t) => t.permission),
        },
      }
    : liveAccount;
  const [tab, setTab] = useState("dashboard"),
    [liveData, setData] = useState<Dashboard | Row[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [nonce, setNonce] = useState(0);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(
      null,
    ),
    [backups, setBackups] = useState<string[]>([]);
  const user = account?.user,
    ready = user?.kind === "STAFF" && user.mfaVerified;
  const permitted = tabs.filter((t) =>
    user?.permissions.includes(t.permission),
  );
  const visibleTab = permitted.some((t) => t.id === tab)
    ? tab
    : permitted[0]?.id;
  const previewData: Record<string, Dashboard | Row[]> = {
    dashboard: {
      customers: 0,
      comments: 0,
      pending: 0,
      products: products.length,
      openOrders: 0,
      mode: "preview",
      paymentReady: false,
    },
    orders: [
      {
        id: "sample-order",
        mode: "RETAIL",
        status: "RESERVED",
        version: 1,
        price: "1450000",
        subtotalToman: "1450000",
        reservedUntil: "2026-10-28T12:00:00.000Z",
        customer: {
          displayName: "مشتری نمونه",
          isDemo: true,
          phone: "•۰۹۱۲۳۴۵۶۷۸۹",
        },
        lines: [
          {
            name: "کیف دستی و دوشی چرم",
            selection: "قهوه‌ای / تکی",
            quantity: 1,
            totalUnits: 1,
            lineTotalToman: "1450000",
          },
        ],
      },
    ],
    products: products.map((p) => ({
      id: p.id,
      name: p.subtitle,
      price: p.price,
      status: "PUBLISHED",
    })),
    comments: [
      {
        id: "sample-comment",
        body: "این فقط یک نمونهٔ نمایشی دیدگاه است؛ از دیتابیس خوانده نشده.",
        status: "VISIBLE",
        author: { displayName: "مشتری نمونه", isDemo: true },
      },
    ],
    partners: [
      {
        id: "sample-partner",
        businessName: "فروشگاه نمونه",
        city: "شهر نمونه",
        note: "پروندهٔ نمایشی؛ هیچ درخواست واقعی یا اطلاعات شخصی در این صفحه نیست.",
        status: "PENDING",
        user: { displayName: "همکار نمونه", isDemo: true },
      },
    ],
    staff: [
      {
        id: "sample-staff",
        displayName: "نقش نمونهٔ مالک",
        isActive: true,
        mfaEnabled: true,
        roles: [{ role: { key: "OWNER", name: "مالک (نمایشی)" } }],
      },
    ],
    audit: [
      { id: "sample-event", action: "رویداد نمونه؛ نه گزارش واقعی امنیت" },
    ],
  };
  const data = preview ? previewData[visibleTab || "dashboard"] : liveData;
  useEffect(() => {
    if (preview || !ready || !visibleTab) return;
    let active = true;
    api<Dashboard | Row[] | { orders: Row[] }>("/api/admin/" + visibleTab)
      .then((value) => {
        if (!active) return;
        setData(
          visibleTab === "orders" && !Array.isArray(value)
            ? (value as { orders: Row[] }).orders
            : (value as Dashboard | Row[]),
        );
        setError("");
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [ready, visibleTab, nonce, preview]);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/staff", {
        method: "POST",
        body: JSON.stringify({
          handle: form.get("handle"),
          password: form.get("password"),
        }),
      });
      authChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      setSetup(
        await api("/api/auth/mfa-setup", { method: "POST", body: "{}" }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ recoveryCodes: string[] }>(
        "/api/auth/mfa-verify",
        { method: "POST", body: JSON.stringify({ code: form.get("code") }) },
      );
      setBackups(result.recoveryCodes);
      setSetup(null);
      authChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (preview) {
      router.push("/");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      setData(null);
      setSetup(null);
      setBackups([]);
      authChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function moderate(row: Row, status: string, reason: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/comments/" + row.id, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      setNonce((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(row: Row, status: string, reason: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/partners/" + row.id, {
        method: "PATCH",
        body: JSON.stringify({ status, reason, version: row.version }),
      });
      setNonce((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const notice =
    error || accountError ? (
      <div className="admin-alert" role="alert">
        <AlertCircle size={18} />
        {error || accountError}
        <button
          onClick={() => {
            refresh();
            setNonce((n) => n + 1);
          }}
        >
          تلاش دوباره
        </button>
      </div>
    ) : null;
  if (!ready || backups.length)
    return (
      <main className="admin-auth">
        <Link href="/" className="admin-return">
          بازگشت به فروشگاه <ArrowUpLeft size={16} />
        </Link>
        <div className="admin-auth-card">
          <Image
            src="/brand/logo-light.webp"
            alt="KIYA"
            width={140}
            height={84}
          />
          <span className="eyebrow">KIYA CONTROL ROOM</span>
          <h1>
            {backups.length
              ? "کدهای بازیابی را نگه دار."
              : user?.kind === "STAFF"
                ? "یک قدم تا ورود امن."
                : "پشت صحنهٔ تجربهٔ کیا."}
          </h1>
          <p>دادهٔ واقعی، دسترسی مشخص، رویداد قابل پیگیری.</p>
          {notice}
          {!account && !accountError ? (
            <p role="status">در حال بررسی نشست…</p>
          ) : null}
          {backups.length ? (
            <>
              <div className="admin-alert">
                این کدها فقط همین بار نمایش داده می‌شوند. در محل امن و خارج از
                مرورگر ذخیره کن؛ هر کد یک بار مصرف است.
              </div>
              <div className="recovery-list" dir="ltr">
                {backups.map((code) => (
                  <code key={code}>{code}</code>
                ))}
              </div>
              <button className="primary" onClick={() => setBackups([])}>
                <Check size={17} /> کدها را امن ذخیره کردم
              </button>
            </>
          ) : user?.kind === "STAFF" ? (
            <>
              {!user.mfaEnabled ? (
                <>
                  <p className="admin-note">
                    ابتدا یک برنامهٔ Authenticator تنظیم کن. بدون مرحلهٔ دوم،
                    داده‌های مدیریت قابل مشاهده نیستند.
                  </p>
                  {!setup ? (
                    <button
                      className="primary"
                      onClick={enroll}
                      disabled={busy}
                    >
                      <KeyRound size={17} /> تنظیم تأیید دومرحله‌ای
                    </button>
                  ) : (
                    <>
                      <label className="admin-secret-label">
                        کلید را فقط در برنامهٔ احراز هویت وارد کن:
                        <code className="admin-secret" dir="ltr">
                          {setup.secret}
                        </code>
                      </label>
                      <p className="micro">
                        حساب TOTP، زمان ۳۰ ثانیه، ۶ رقم، SHA1. این کلید را با
                        کسی به اشتراک نگذار.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <p>
                  کد شش‌رقمی برنامهٔ احراز هویت یا یک کد بازیابی را وارد کن.
                </p>
              )}
              {user.mfaEnabled || setup ? (
                <form className="backend-form" onSubmit={verify}>
                  <label>
                    کد تأیید یا بازیابی
                    <input
                      name="code"
                      dir="ltr"
                      autoComplete="one-time-code"
                      minLength={6}
                      maxLength={32}
                      required
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    تأیید و ورود به مدیریت
                  </button>
                </form>
              ) : null}
              <button className="text-link" disabled={busy} onClick={logout}>
                خروج از نشست
              </button>
            </>
          ) : (
            <>
              <Link className="secondary" href="/admin/preview">
                دیدن نمایش مدیریت (فقط خواندنی)
              </Link>
              <div className="admin-auth-symbol">
                <LockKeyhole size={24} />
              </div>
              <form className="backend-form" onSubmit={login}>
                <label>
                  شناسهٔ پرسنلی یا شمارهٔ موبایل
                  <input
                    name="handle"
                    dir="ltr"
                    autoComplete="username"
                    maxLength={60}
                    required
                  />
                </label>
                <label>
                  رمز عبور
                  <input
                    name="password"
                    type="password"
                    dir="ltr"
                    autoComplete="current-password"
                    maxLength={200}
                    required
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {busy ? "در حال بررسی…" : "ادامهٔ ورود امن"}
                </button>
              </form>
              <p className="admin-note">
                حساب عمومی یا رمز پیش‌فرض وجود ندارد. حساب مالک فقط با ابزار
                راه‌اندازی محلی ساخته می‌شود؛ ورود آزمایشی مشتری دسترسی مدیریت
                نمی‌دهد.
              </p>
            </>
          )}
        </div>
        <span className="admin-footer-note">
          KIYA · PRIVATE WORKSPACE · ۲۰۲۶
        </span>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <Image
            src="/brand/logo-light.webp"
            alt="KIYA"
            width={104}
            height={64}
          />
          <span>فضای مدیریت</span>
        </Link>
        <div className="admin-workspace">
          <span className="admin-online" />
          <div>
            <strong>فروشگاه کیا</strong>
            <small>
              {preview ? "نمایش رابط، بدون ورود" : "نشست دومرحله‌ای تأیید شده"}
            </small>
          </div>
        </div>
        <small className="admin-nav-label">میز کار</small>
        <nav aria-label="ناوبری مدیریت">
          {permitted.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={visibleTab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setData(null);
                setError("");
              }}
            >
              <Icon size={19} />
              {label}
              {visibleTab === id ? <span /> : null}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/progress">نقشهٔ تکمیل پروژه</Link>
          <Link href="/">
            مشاهدهٔ فروشگاه <ArrowUpLeft size={16} />
          </Link>
          <button disabled={busy} onClick={logout}>
            <LogOut size={17} />
            خروج امن
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <div>
            <span className="eyebrow">WORKSPACE / KIYA</span>
            <p>امروز، فرصتی برای یک تجربهٔ بهتر.</p>
          </div>
          <div className="admin-person">
            <ShieldCheck size={21} />
            <div>
              <b>{user?.name}</b>
              <small>
                {preview
                  ? "نمونهٔ رابط، بدون مجوز سروری"
                  : "دسترسی از سمت سرور بررسی می‌شود"}
              </small>
            </div>
          </div>
        </header>
        <main className="admin-content">
          <div className="admin-page-heading">
            <div>
              <span className="eyebrow">YOUR STORE, IN FOCUS</span>
              <h1>
                {tabs.find((t) => t.id === visibleTab)?.label || "بدون دسترسی"}
              </h1>
              <p>
                {preview
                  ? "ساختار مدیریت با داده‌های نمونه، نه اطلاعات واقعی."
                  : "آنچه اکنون در پایگاه دادهٔ کیا می‌گذرد."}
              </p>
            </div>
            <button
              className="secondary"
              onClick={() => setNonce((n) => n + 1)}
            >
              <RefreshCw size={16} />
              تازه‌سازی
            </button>
          </div>
          {preview ? (
            <section
              className="admin-preview-notice"
              aria-label="نمایش فقط خواندنی"
            >
              <strong>نمایش مدیریت · فقط خواندنی</strong>
              <p>
                این صفحه نمونهٔ رابط است؛ حساب مدیر، ورود واقعی یا دسترسی به
                دیتابیس ایجاد نمی‌کند. داده‌ها نمونه‌اند و دکمه‌های تغییر
                اطلاعات در دسترس نیستند.
              </p>
              <Link href="/admin">ورود واقعی پرسنل</Link> ·{" "}
              <Link href="/">بازگشت به فروشگاه</Link>
            </section>
          ) : null}
          <div className="admin-banner">
            <ShieldCheck size={20} />
            <p>
              <b>مرحلهٔ زیرساخت، نه فروشگاه آمادهٔ فروش.</b> دیدگاه و بررسی
              همکار و مدیریت موجودی متصل‌اند. سفارش اولیه و رزرو مشتری فعال است؛
              پرداخت، ارسال و پیامک هنوز فعال نیستند. حساب‌های آزمایشی برچسب
              دارند.
            </p>
          </div>
          {notice}
          {!visibleTab ? (
            <p className="admin-note">
              برای این حساب هیچ بخش مدیریتی مجاز نشده است.
            </p>
          ) : null}
          {!data && !error && visibleTab ? (
            <p role="status">در حال دریافت دادهٔ سرور…</p>
          ) : null}
          {data && !Array.isArray(data) ? (
            <>
              <div className="admin-metrics">
                {[
                  {
                    label: "مشتریان ثبت‌شده",
                    value: data.customers,
                    icon: UsersRound,
                    note: preview
                      ? "آمار واقعی در این نما خوانده نمی‌شود"
                      : "شامل حساب‌های آزمایشی",
                  },
                  {
                    label: "دیدگاه‌های نمایان",
                    value: data.comments,
                    icon: MessageCircle,
                    note: "گفت‌وگوی عمومیِ ذخیره‌شده",
                  },
                  {
                    label: "همکار منتظر بررسی",
                    value: data.pending,
                    icon: ShieldCheck,
                    note: "بدون تأیید خودکار",
                  },
                  {
                    label: "محصول نمونه",
                    value: data.products,
                    icon: Package,
                    note: "کاتالوگ اولیهٔ آزمایشی",
                  },
                  {
                    label: "سفارش در جریان",
                    value: data.openOrders ?? 0,
                    icon: ClipboardList,
                    note: "رزرو تا ارسال، بدون پرداخت",
                  },
                ].map(({ label, value, icon: Icon, note }) => (
                  <section className="admin-metric" key={label}>
                    <div>
                      <span>{label}</span>
                      <Icon size={19} />
                    </div>
                    <strong>{faNumber(value)}</strong>
                    <small>{note}</small>
                  </section>
                ))}
              </div>
              <div className="admin-dashboard-grid">
                <section className="admin-card">
                  <div className="admin-card-title">
                    <h2>کارهای امروز</h2>
                    <span>از واقعیت شروع کنیم</span>
                  </div>
                  <div className="admin-task">
                    <span className="task-number">۰۱</span>
                    <div>
                      <h3>بررسی درخواست‌های همکاری</h3>
                      <p>
                        {faNumber(data.pending)} پرونده در انتظار تصمیم پشتیبانی
                        است.
                      </p>
                    </div>
                  </div>
                  <div className="admin-task">
                    <span className="task-number">۰۲</span>
                    <div>
                      <h3>مراقبت از فضای گفت‌وگو</h3>
                      <p>
                        دیدگاه‌ها را بررسی کن؛ پنهان‌سازی همیشه با ثبت دلیل
                        همراه است.
                      </p>
                    </div>
                  </div>
                  <div className="admin-task">
                    <span className="task-number">۰۳</span>
                    <div>
                      <h3>قبل از شروع فروش</h3>
                      <p>
                        اتصال پیامک، قیمت‌های تأییدشده، انبار و پرداخت باید
                        تکمیل و آزموده شوند.
                      </p>
                    </div>
                  </div>
                </section>
                <section className="admin-purple-card">
                  <span className="eyebrow">TRUST IS BUILT IN DETAILS</span>
                  <h2>
                    هر دسترسی،
                    <br />
                    یک مسئولیت.
                  </h2>
                  <p>
                    نقش‌ها در پایگاه داده نگه‌داری می‌شوند. هر درخواست مدیریتی
                    مجوز و تأیید دومرحله‌ای را دوباره بررسی می‌کند.
                  </p>
                  <div>
                    <ShieldCheck size={17} />
                    نشست ۸ ساعته · کوکی HttpOnly
                  </div>
                  <small>
                    مدیر کل می‌تواند در بخش تیم، حساب پرسنلی و نقش سفارشی بسازد.
                    محدودسازی مجوز به کالا یا انبار مشخص هنوز فعال نیست.
                  </small>
                </section>
              </div>
            </>
          ) : null}
          {!preview &&
          visibleTab === "products" &&
          user?.permissions.includes("product:write") ? (
            <section className="admin-card">
              <h2>ساخت پیش‌نویس کالا</h2>
              <p className="admin-note">
                ابتدا پیش‌نویس بسازید؛ سپس در پروندهٔ کالا مشخصات، تصویر، رنگ و
                موجودی را تکمیل کنید. انتشار ویترین به معنی فعال‌شدن پرداخت
                نیست.
              </p>
              <DraftProductForm onSaved={() => setNonce((n) => n + 1)} />
            </section>
          ) : null}
          {!preview &&
          visibleTab === "staff" &&
          user?.permissions.includes("staff:manage") ? (
            <AccessManagement selfId={user.id} />
          ) : null}
          {Array.isArray(data) &&
          !(
            visibleTab === "staff" &&
            !preview &&
            user?.permissions.includes("staff:manage")
          ) ? (
            <section className="admin-card admin-records">
              <div className="admin-card-title">
                <h2>آخرین رکوردها</h2>
                <span>
                  {preview
                    ? "فقط دادهٔ نمونه، بدون اتصال به حساب"
                    : "حداکثر ۵۰ رکورد · دادهٔ سرور"}
                </span>
              </div>
              {!data.length ? (
                <div className="admin-empty">
                  <ScrollText size={32} />
                  <h3>اینجا هنوز رکوردی نیست.</h3>
                  <p>
                    {visibleTab === "orders"
                      ? "تا وقتی مشتری سفارش اولیه ثبت نکند، سفارشی ساخته نمی‌شود؛ دادهٔ نمایشی برای پرکردن فهرست تولید نمی‌کنیم."
                      : "دادهٔ نمایشی برای پرکردن آمار تولید نمی‌کنیم."}
                  </p>
                </div>
              ) : (
                data.map((row) => (
                  <article className="admin-record" key={row.id}>
                    <div className="admin-record-heading">
                      <h3>
                        {visibleTab === "orders"
                          ? "سفارش " + row.id.slice(0, 8)
                          : null}
                        {visibleTab === "orders"
                          ? null
                          : row.businessName ||
                            row.name ||
                            row.displayName ||
                            row.customer?.displayName ||
                            row.author?.displayName ||
                            row.action ||
                            row.id}
                      </h3>
                      {row.status ? (
                        <span
                          className={"admin-status " + row.status.toLowerCase()}
                        >
                          {(
                            {
                              PENDING: "در انتظار",
                              APPROVED: "تأیید شده",
                              REJECTED: "رد شده",
                              SUSPENDED: "تعلیق",
                              VISIBLE: "نمایان",
                              HIDDEN: "پنهان",
                              DELETED: "حذف شده",
                              PUBLISHED: "منتشرشده",
                              DRAFT: "پیش‌نویس",
                              RESERVED: "رزرو فعال",
                              CONFIRMED: "تأییدشده",
                              PREPARING: "در حال آماده‌سازی",
                              SHIPPED: "ارسال‌شده",
                              COMPLETED: "تکمیل‌شده",
                              EXPIRED: "منقضی‌شده",
                              CANCELLED: "لغوشده",
                            } as Record<string, string>
                          )[row.status] || row.status}
                        </span>
                      ) : null}
                    </div>
                    {row.author?.isDemo || row.user?.isDemo ? (
                      <small className="admin-demo-tag">حساب آزمایشی</small>
                    ) : null}
                    {row.body ? (
                      <p className="admin-record-body">{row.body}</p>
                    ) : null}
                    {row.note ? (
                      <p>
                        {row.city} · {row.note}
                      </p>
                    ) : null}
                    {row.price ? (
                      <p>
                        {money(row.price)} تومان ·{" "}
                        {row.status === "DRAFT"
                          ? "قیمت پایهٔ پیش‌نویس"
                          : "قیمت خردهٔ نمونه"}
                      </p>
                    ) : null}
                    {visibleTab === "orders" && row.customer ? (
                      <>
                        <p>
                          {row.customer.displayName}
                          {row.customer.isDemo ? " · حساب آزمایشی" : ""}
                          {row.customer.phone
                            ? ` · موبایل ${row.customer.phone}`
                            : " · بدون موبایل ثبت‌شده"}{" "}
                          · {row.mode === "WHOLESALE" ? "عمده" : "تکی"} · مبلغ
                          ثبت‌شده: {money(row.subtotalToman || "0")} تومان
                        </p>
                        {row.lines?.length ? (
                          <div className="order-lines">
                            {row.lines.map((line, i) => (
                              <span key={i}>
                                {line.name} · {line.selection} ·{" "}
                                {faNumber(line.quantity)} واحد ·{" "}
                                {money(line.lineTotalToman)} تومان
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {row.status === "RESERVED" && row.reservedUntil ? (
                          <p className={row.expiry ? "order-warning" : "micro"}>
                            پایان رزرو:{" "}
                            {new Date(row.reservedUntil).toLocaleString(
                              "fa-IR",
                            )}
                            {row.expiry
                              ? " — مهلت تمام شده؛ تا آزادسازی، رزرو در وضعیت انتظار است."
                              : ""}
                          </p>
                        ) : null}
                        {row.endedAt ? (
                          <p className="micro">
                            پایان پرونده:{" "}
                            {new Date(row.endedAt).toLocaleString("fa-IR")}
                          </p>
                        ) : null}
                        {!preview && typeof row.version === "number" ? (
                          <OrderManager
                            id={row.id}
                            status={row.status || ""}
                            version={row.version}
                            canManage={
                              !!user?.permissions.includes("order:manage")
                            }
                            onSaved={() => setNonce((n) => n + 1)}
                          />
                        ) : null}
                      </>
                    ) : null}
                    {row.roles ? (
                      <p>
                        {row.roles.map((r) => r.role.name).join("، ")} · MFA:{" "}
                        {row.mfaEnabled ? "فعال" : "در انتظار تنظیم"} · حساب{" "}
                        {row.isActive ? "فعال" : "غیرفعال"}
                      </p>
                    ) : null}
                    {!preview &&
                    visibleTab === "products" &&
                    row.status === "DRAFT" &&
                    user?.permissions.includes("product:write") ? (
                      <DraftProductForm
                        product={{
                          id: row.id,
                          name: row.name!,
                          price: row.price!,
                          version: row.version!,
                        }}
                        onSaved={() => setNonce((n) => n + 1)}
                      />
                    ) : null}
                    {!preview && visibleTab === "products" ? (
                      <ProductWorkbench
                        id={row.id}
                        permissions={user?.permissions || []}
                        onSaved={() => setNonce((n) => n + 1)}
                      />
                    ) : null}
                    {!preview &&
                    visibleTab === "partners" &&
                    row.status === "APPROVED" &&
                    user?.permissions.includes("partner:approve") ? (
                      <PartnerValidity
                        id={row.id}
                        version={row.version!}
                        expiresAt={row.expiresAt || null}
                        onSaved={() => setNonce((n) => n + 1)}
                      />
                    ) : null}
                    <div className="admin-record-meta">
                      {row.postId ? <code dir="ltr">{row.postId}</code> : null}
                      {row.createdAt ? (
                        <time dateTime={row.createdAt}>
                          {new Date(row.createdAt).toLocaleString("fa-IR")}
                        </time>
                      ) : null}
                      {visibleTab === "audit" && row.resourceId ? (
                        <code dir="ltr">{row.resourceId}</code>
                      ) : null}
                    </div>
                    {!preview &&
                    visibleTab === "comments" &&
                    row.status !== "DELETED" &&
                    user?.permissions.includes("comment:moderate") ? (
                      <DecisionForm
                        busy={busy}
                        options={[
                          {
                            value:
                              row.status === "VISIBLE" ? "HIDDEN" : "VISIBLE",
                            label:
                              row.status === "VISIBLE"
                                ? "پنهان کردن"
                                : "نمایش دوباره",
                          },
                        ]}
                        onSubmit={(status, reason) =>
                          moderate(row, status, reason)
                        }
                      />
                    ) : null}
                    {!preview && visibleTab === "partners" ? (
                      <DecisionForm
                        busy={busy}
                        options={[
                          ...(user?.permissions.includes("partner:approve") &&
                          ["PENDING", "SUSPENDED"].includes(row.status || "")
                            ? [{ value: "APPROVED", label: "تأیید همکاری" }]
                            : []),
                          ...(user?.permissions.includes("partner:review") &&
                          row.status === "PENDING"
                            ? [{ value: "REJECTED", label: "رد درخواست" }]
                            : []),
                          ...(user?.permissions.includes("partner:suspend") &&
                          row.status === "APPROVED"
                            ? [{ value: "SUSPENDED", label: "تعلیق همکاری" }]
                            : []),
                        ]}
                        onSubmit={(status, reason) =>
                          review(row, status, reason)
                        }
                      />
                    ) : null}
                  </article>
                ))
              )}
            </section>
          ) : null}
          {visibleTab === "staff" &&
          (preview || !user?.permissions.includes("staff:manage")) ? (
            <p className="admin-note">
              این نما فهرست خواندنی تیم است. ساخت حساب، تغییر وضعیت و نقش سفارشی
              فقط در نشست واقعی مدیر کل در دسترس است.
            </p>
          ) : null}
          {!preview ? <PasswordChange /> : null}
        </main>
        <footer className="admin-bottom">
          KIYA / CONTROL ROOM <span>بدون آمار ساختگی. بدون تأیید خودکار.</span>
        </footer>
      </div>
    </div>
  );
}
function DecisionForm({
  options,
  busy,
  onSubmit,
}: {
  options: { value: string; label: string }[];
  busy: boolean;
  onSubmit: (status: string, reason: string) => Promise<void>;
}) {
  if (!options.length) return null;
  return (
    <form
      className="admin-decision"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        await onSubmit(
          String(values.get("status")),
          String(values.get("reason")),
        );
      }}
    >
      <label>
        <span className="sr-only">تصمیم</span>
        <select name="status">
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">دلیل تصمیم</span>
        <input
          name="reason"
          placeholder="دلیل تصمیم (الزامی)"
          minLength={3}
          maxLength={500}
          required
        />
      </label>
      <button className="primary" disabled={busy}>
        ثبت تصمیم
      </button>
    </form>
  );
}
