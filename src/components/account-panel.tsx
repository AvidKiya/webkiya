"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api, authChanged, useAccount } from "@/lib/api";
export function AccountPanel({ compact = false }: { compact?: boolean }) {
  const { account, error, refresh } = useAccount();
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  async function action(name: string) {
    setBusy(true);
    setFailure("");
    try {
      await api("/api/auth/" + name, { method: "POST", body: "{}" });
      authChanged();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={
        compact ? "backend-account compact" : "surface backend-account"
      }
    >
      <span className="eyebrow">KIYA ACCOUNT</span>
      {!account && !error ? <p role="status">در حال بررسی نشست…</p> : null}
      {error ? (
        <p role="alert">
          {error} <button onClick={refresh}>تلاش دوباره</button>
        </p>
      ) : null}
      {account?.user ? (
        <>
          <h3>{account.user.name}</h3>
          <p>
            {account.user.isDemo
              ? "حساب آزمایشی با نشست سروری؛ بدون تأیید هویت یا شمارهٔ موبایل."
              : "نشست شما فعال است."}
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => action("logout")}
          >
            خروج از حساب
          </button>
          {account.user.kind === "STAFF" ? (
            <Link href="/admin" className="text-link">
              رفتن به مدیریت
            </Link>
          ) : null}
        </>
      ) : account ? (
        <>
          <h3>به گفت‌وگوی کیا بپیوند.</h3>
          <p>پیامک ورود هنوز متصل نیست. شماره یا اطلاعات شخصی وارد نکن.</p>
          {account.demoLoginAvailable ? (
            <>
              <button
                className="primary"
                disabled={busy}
                onClick={() => action("demo")}
              >
                {busy ? "در حال ورود…" : "ورود آزمایشی"}
              </button>
              <p className="micro">
                فقط برای بررسی سایت؛ این ورود، تأیید پیامکی یا حساب تجاری واقعی
                نیست. دیدگاه‌ها برای دیگران هم نمایش داده می‌شوند.
              </p>
            </>
          ) : (
            <p className="demo-callout">
              ورود واقعی پس از پیکربندی و آزمون سرویس پیامک فعال می‌شود.
            </p>
          )}
        </>
      ) : null}
      {failure ? <p role="alert">{failure}</p> : null}
      {!compact ? (
        <>
          <Link className="text-link" href="/admin">
            ورود پرسنل به مدیریت
          </Link>
          <Link href="/admin/preview" className="text-link">
            نمایش مدیریت بدون ورود (فقط خواندنی)
          </Link>
          <p className="micro">
            پسندها، ذخیره‌ها و سبد هنوز محلی‌اند. سفارش و پرداخت فعال نیست.
          </p>
        </>
      ) : null}
    </section>
  );
}
type Partner = {
  id: string;
  businessName: string;
  city: string;
  note: string;
  status: string;
  reason: string | null;
  version: number;
};
const statuses: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
  SUSPENDED: "تعلیق شده",
};
export function PartnerPanel({ showLogin = true }: { showLogin?: boolean }) {
  const { account } = useAccount();
  const [application, setApplication] = useState<Partner | null | undefined>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const userId = account?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    api<{ application: Partner | null }>("/api/partner")
      .then((result) => {
        if (active) setApplication(result.application);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/partner", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const result = await api<{ application: Partner | null }>("/api/partner");
      setApplication(result.application);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!account?.user)
    return showLogin ? (
      <AccountPanel compact />
    ) : (
      <p className="micro">برای ثبت درخواست، ابتدا وارد حساب بالا شو.</p>
    );
  return (
    <div className="backend-partner">
      <p className="demo-callout">
        درخواست در پایگاه داده ثبت می‌شود. قیمت‌گذاری و سفارش عمده هنوز فعال
        نیست؛ حداقل همکاری یک جین است، بدون حداقل مبلغ.
      </p>
      {account.user.isDemo ? (
        <p className="micro">
          این حساب آزمایشی است؛ فقط اطلاعات نمونه وارد کن.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {application ? (
        <div role="status">
          <h3>وضعیت: {statuses[application.status]}</h3>
          <p>
            {application.businessName} · {application.city}
          </p>
          {application.reason ? <p>{application.reason}</p> : null}
          <small>
            حتی پس از تأیید، تا اتصال لیست قیمت اختصاصی، قیمت عمده‌ای نمایش داده
            نمی‌شود.
          </small>
        </div>
      ) : application === null ? (
        <form className="backend-form" onSubmit={submit}>
          <label>
            نام فروشگاه یا کسب‌وکار
            <input name="businessName" minLength={2} maxLength={100} required />
          </label>
          <label>
            شهر
            <input name="city" minLength={2} maxLength={80} required />
          </label>
          <label>
            توضیح درخواست
            <textarea
              name="note"
              minLength={5}
              maxLength={500}
              required
              rows={3}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "در حال ثبت…" : "ثبت درخواست همکاری"}
          </button>
        </form>
      ) : !error ? (
        <p role="status">در حال دریافت وضعیت…</p>
      ) : null}
    </div>
  );
}
