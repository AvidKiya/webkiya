"use client";
import "./integration-settings.css";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
type Settings = {
  version: number;
  telegramEnabled: boolean;
  botUsername: string;
  botTokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  cardEnabled: boolean;
  bankName: string;
  cardNumber: string;
  cardHolder: string;
  shippingToman: string;
  taxToman: string;
  transferMinutes: number;
};
type Payment = {
  id: string;
  orderId: string;
  status: string;
  version: number;
  amountToman: string;
  bankVerifiedReference?: string | null;
  destination: { bankName: string; cardNumber: string; cardHolder: string };
  hasReceipt: boolean;
  transferReference: string | null;
  shippingAddress: {
    recipient?: string;
    phone?: string;
    city?: string;
    address?: string;
    postalCode?: string;
  };
};
export function IntegrationSettings({
  financeOnly = false,
}: {
  financeOnly?: boolean;
}) {
  const [data, setData] = useState<Settings | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [token, setToken] = useState(""),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [payments, setPayments] = useState<Payment[]>([]),
    [reason, setReason] = useState<Record<string, string>>({}),
    [bankReferences, setBankReferences] = useState<Record<string, string>>({}),
    [reconciled, setReconciled] = useState<Record<string, boolean>>({});
  async function load() {
    if (!financeOnly) {
      const value = await api<Settings>("/api/admin/settings");
      setData(value);
    }
    const rows = await api<{ items: Payment[] }>("/api/admin/payments");
    setPayments(rows.items);
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      financeOnly
        ? Promise.resolve(null)
        : api<Settings>("/api/admin/settings"),
      api<{ items: Payment[] }>("/api/admin/payments"),
    ])
      .then(([settings, rows]) => {
        if (active) {
          setData(settings);
          setPayments(rows.items);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "دریافت تنظیمات ناموفق بود.",
          );
      });
    return () => {
      active = false;
    };
  }, [financeOnly]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!data) return;
    const { botTokenConfigured, webhookSecretConfigured, ...values } = data;
    void botTokenConfigured;
    void webhookSecretConfigured;
    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...values,
        ...(token ? { botToken: token } : {}),
        ...(secret ? { webhookSecret: secret } : {}),
      }),
    });
    setToken("");
    setSecret("");
    await load();
    setNotice("تنظیمات ذخیره شد. ذخیره کلید به معنی تست اتصال یا پرداخت نیست.");
  }
  return (
    <main className="integration-settings" dir="rtl">
      <Link href="/admin">بازگشت به مدیریت امن / ورود با MFA</Link>
      <h1>
        {financeOnly
          ? "بررسی رسیدها و تطبیق بانک"
          : "تنظیمات اتصال‌ها و پرداخت کارت‌به‌کارت"}
      </h1>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!data && !financeOnly && !error && <p>در حال بررسی دسترسی مدیر کل…</p>}
      {data && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(save);
            }}
            className="admin-card"
            style={{ display: "grid", gap: 14 }}
          >
            <h2>ورود مشتری با ربات تلگرام</h2>
            <p>
              فقط توکن جدید BotFather را وارد کنید. مقدار ذخیره‌شده هرگز
              بازخوانی نمی‌شود. ورود کارکنان همچنان رمز و MFA است.
            </p>
            <label>
              <input
                type="checkbox"
                checked={data.telegramEnabled}
                onChange={(e) =>
                  setData({ ...data, telegramEnabled: e.target.checked })
                }
              />{" "}
              فعال‌سازی ورود تلگرام
            </label>
            <label>
              نام کاربری ربات
              <input
                value={data.botUsername}
                onChange={(e) =>
                  setData({ ...data, botUsername: e.target.value })
                }
              />
            </label>
            <label>
              توکن جدید ربات ·{" "}
              {data.botTokenConfigured ? "تنظیم شده" : "تنظیم نشده"}
              <input
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <label>
              Webhook secret مستقل (حداقل۳۲ کاراکتر) ·{" "}
              {data.webhookSecretConfigured ? "تنظیم شده" : "تنظیم نشده"}
              <input
                type="password"
                autoComplete="new-password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </label>
            <p>
              پس از ذخیره، worker را با دستور مستند اجرا و اتصال واقعی را آزمایش
              کنید. توکن را در گفتگو ارسال نکنید.
            </p>
            <div>
              {(["test", "webhook", "polling"] as const).map((action) => (
                <button
                  type="button"
                  key={action}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await api<{ message: string }>(
                        "/api/admin/settings/telegram",
                        { method: "POST", body: JSON.stringify({ action }) },
                      );
                      setNotice(result.message);
                    })
                  }
                >
                  {action === "test"
                    ? "آزمون اتصال واقعی ربات"
                    : action === "webhook"
                      ? "ثبت webhook روی دامنه میزبان"
                      : "استفاده از polling (حذف webhook)"}
                </button>
              ))}
            </div>
            <h2>کارت‌به‌کارت</h2>
            <label>
              <input
                type="checkbox"
                checked={data.cardEnabled}
                onChange={(e) =>
                  setData({ ...data, cardEnabled: e.target.checked })
                }
              />{" "}
              فعال‌سازی پرداخت دستی پس از ثبت نشانی
            </label>
            {(
              [
                "bankName",
                "cardNumber",
                "cardHolder",
                "shippingToman",
                "taxToman",
              ] as const
            ).map((key) => (
              <label key={key}>
                {
                  {
                    bankName: "نام بانک",
                    cardNumber: "شماره کارت مقصد (۱۶ رقم انگلیسی)",
                    cardHolder: "صاحب حساب",
                    shippingToman: "هزینه ثابت ارسال، تومان",
                    taxToman: "مالیات ثابت مصوب فروشگاه، تومان",
                  }[key]
                }
                <input
                  value={data[key]}
                  onChange={(e) => setData({ ...data, [key]: e.target.value })}
                />
              </label>
            ))}
            <label>
              مهلت واریز و بررسی (دقیقه،۱۵ تا۱۴۴۰)
              <input
                type="number"
                min={15}
                max={1440}
                value={data.transferMinutes}
                onChange={(e) =>
                  setData({ ...data, transferMinutes: Number(e.target.value) })
                }
              />
            </label>
            <p>
              با فعال‌سازی، صحت حساب مقصد و تعرفه‌ها (حتی مقدار صفر) را تأیید
              می‌کنید. اطلاعات مقصد در سفارش snapshot می‌شود. فعلاً درگاه آنلاین
              فعال نمی‌شود.
            </p>
            <button disabled={busy}>ذخیره امن تنظیمات</button>
          </form>
        </>
      )}
      {(data || financeOnly) && (
        <>
          <h2>رسیدها و تطبیق واقعی بانک</h2>
          <button disabled={busy} onClick={() => void run(load)}>
            تازه‌سازی
          </button>
          {payments.length === 0 && <p>رسیدی برای بررسی وجود ندارد.</p>}
          {payments.map((p) => (
            <section
              key={p.id}
              className="admin-card"
              style={{ border: "1px solid #777", padding: 16, marginTop: 12 }}
            >
              <h3>
                سفارش <bdi>{p.orderId}</bdi>
              </h3>
              <p>
                مبلغ: {p.amountToman} تومان · وضعیت: {p.status}
              </p>
              <p>
                گیرنده: {p.shippingAddress.recipient} · تماس:{" "}
                {p.shippingAddress.phone} · {p.shippingAddress.city} ·{" "}
                {p.shippingAddress.address} · کدپستی:{" "}
                {p.shippingAddress.postalCode}
              </p>
              <p>
                مقصد ثابت این پرداخت: {p.destination.bankName} ·{" "}
                {p.destination.cardHolder} ·{" "}
                <bdi>{p.destination.cardNumber}</bdi>. تطبیق باید با همین مقصد
                باشد، نه تنظیمات فعلی بانک.
              </p>
              <p>کد پیگیری ادعاشده: {p.transferReference || "ثبت نشده"}</p>
              {p.bankVerifiedReference && (
                <p>
                  ردیف تطبیق‌شدهٔ بانک: <bdi>{p.bankVerifiedReference}</bdi>
                </p>
              )}
              {p.hasReceipt && (
                <a
                  href={"/api/payments/" + p.id + "/receipt"}
                  target="_blank"
                  rel="noreferrer"
                >
                  بازکردن رسید خصوصی
                </a>
              )}
              {p.status === "UNDER_REVIEW" && (
                <div>
                  <label>
                    شناسهٔ یکتای ردیف گردش بانک (از بانک، نه ادعای مشتری)
                    <input
                      dir="ltr"
                      value={bankReferences[p.id] || ""}
                      onChange={(e) =>
                        setBankReferences({
                          ...bankReferences,
                          [p.id]: e.target.value,
                        })
                      }
                      placeholder="YYYY-MM-DD:BANK-STATEMENT-ENTRY-ID"
                    />
                  </label>
                  <label>
                    شرح بررسی بانک
                    <textarea
                      minLength={10}
                      maxLength={500}
                      value={reason[p.id] || ""}
                      onChange={(e) =>
                        setReason({ ...reason, [p.id]: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!reconciled[p.id]}
                      onChange={(e) =>
                        setReconciled({
                          ...reconciled,
                          [p.id]: e.target.checked,
                        })
                      }
                    />{" "}
                    واریز واقعی، مبلغ و حساب مقصد را در گردش بانک تطبیق داده‌ام؛
                    صرفاً تصویر را ندیده‌ام.
                  </label>
                  {(["CONFIRM", "REJECT"] as const).map((decision) => (
                    <button
                      key={decision}
                      disabled={
                        busy ||
                        (reason[p.id] || "").trim().length < 10 ||
                        (decision === "CONFIRM" &&
                          (!reconciled[p.id] ||
                            (bankReferences[p.id] || "").trim().length < 6))
                      }
                      onClick={() =>
                        void run(async () => {
                          await api("/api/admin/payments/" + p.id, {
                            method: "POST",
                            body: JSON.stringify({
                              version: p.version,
                              decision,
                              reason: reason[p.id],
                              bankReconciled: !!reconciled[p.id],
                              ...(decision === "CONFIRM"
                                ? { bankReference: bankReferences[p.id] }
                                : {}),
                            }),
                          });
                          await load();
                        })
                      }
                    >
                      {decision === "CONFIRM"
                        ? "تأیید واریز تطبیق‌یافته"
                        : "رد رسید با دلیل"}
                    </button>
                  ))}
                </div>
              )}
              {p.status === "REFUND_REQUIRED" && (
                <p>
                  این واریز به سفارش معتبر تبدیل نشده؛ استرداد خارج از سامانه
                  باید پیگیری و مستند شود. ارسال نکنید.
                </p>
              )}
            </section>
          ))}
        </>
      )}
    </main>
  );
}
