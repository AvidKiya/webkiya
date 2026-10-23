import { useEffect, useState } from "react";
import { api } from "../../services/catalog";
import { formatToman } from "../../services/wholesale";
type Payment = {
  id: string;
  amountToman: string;
  shippingToman: string;
  taxToman: string;
  status: string;
  version: number;
  hasReceipt: boolean;
  reviewReason: string | null;
  shippingAddress: {
    recipient: string;
    phone: string;
    city: string;
    address: string;
    postalCode: string;
  };
  destination: { bankName: string; cardNumber: string; cardHolder: string };
};
type Info = {
  payment: Payment | null;
  available: boolean;
  reservedUntil: string;
  orderStatus: string;
};
const statuses: Record<string, string> = {
  AWAITING_TRANSFER: "در انتظار واریز و ثبت رسید",
  UNDER_REVIEW: "رسید ثبت شد؛ در انتظار تطبیق بانک",
  REJECTED: "رسید تأیید نشد؛ دلیل را بخوانید",
  CONFIRMED: "پرداخت توسط مسئول مجاز تأیید شد",
  REFUND_REQUIRED:
    "واریز تأیید شده ولی رزرو پایان یافته؛ نیازمند پیگیری استرداد دستی",
};
export function ManualPaymentView({
  orderId,
  onChanged,
}: {
  orderId: string;
  onChanged: () => Promise<void>;
}) {
  const [info, setInfo] = useState<Info | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reference, setReference] = useState(""),
    [file, setFile] = useState<File | null>(null);
  async function load() {
    setInfo(
      await api<Info>("/api/payments?orderId=" + encodeURIComponent(orderId)),
    );
  }
  useEffect(() => {
    let active = true;
    api<Info>("/api/payments?orderId=" + encodeURIComponent(orderId))
      .then((v) => {
        if (active) setInfo(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [orderId]);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fields = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/payments", {
        orderId,
        recipient: fields.get("recipient"),
        phone: fields.get("phone"),
        city: fields.get("city"),
        address: fields.get("address"),
        postalCode: fields.get("postalCode"),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشانی ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !info?.payment || busy) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("reference", reference);
      body.set("version", String(info.payment.version));
      const response = await fetch(
        "/api/payments/" + info.payment.id + "/receipt",
        { method: "POST", body, credentials: "same-origin" },
      );
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.error?.message || "ثبت رسید ناموفق بود.");
      await load();
      setFile(null);
      setReference("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت رسید ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="rounded-xl border border-border p-3 space-y-3"
      aria-label="پرداخت کارت به کارت"
    >
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {!info && !error && <p role="status">در حال خواندن وضعیت پرداخت…</p>}
      {info &&
        !info.payment &&
        (info.available && info.orderStatus === "RESERVED" ? (
          <form onSubmit={create} className="space-y-3">
            <h3 className="font-bold">نشانی و پرداخت کارت‌به‌کارت</h3>
            <p className="text-xs text-ink-600">
              پس از ثبت نشانی، مبلغ نهایی و کارت مقصد از سرور دریافت می‌شود. پیش
              از دریافت آن واریز نکنید.
            </p>
            {[
              ["recipient", "نام گیرنده", 100],
              ["phone", "شماره تماس گیرنده", 15],
              ["city", "شهر", 80],
              ["postalCode", "کد پستی ده‌رقمی", 10],
            ].map(([name, label, max]) => (
              <label key={String(name)} className="block text-xs">
                {label}
                <input
                  name={String(name)}
                  required
                  maxLength={Number(max)}
                  pattern={
                    name === "postalCode"
                      ? "[0-9]{10}"
                      : name === "phone"
                        ? "[+]?[0-9]{10,15}"
                        : undefined
                  }
                  className="block w-full rounded-lg border border-border bg-canvas-sunken p-2 mt-1"
                />
              </label>
            ))}
            <label className="block text-xs">
              نشانی کامل
              <textarea
                name="address"
                required
                minLength={10}
                maxLength={500}
                className="block w-full rounded-lg border border-border bg-canvas-sunken p-2 mt-1"
              />
            </label>
            <button
              disabled={busy}
              className="bg-buy text-buy-fg rounded-xl p-3"
            >
              دریافت شماره کارت و مبلغ نهایی
            </button>
          </form>
        ) : (
          <p className="text-xs text-ink-500">
            {info.orderStatus === "RESERVED"
              ? "روش کارت‌به‌کارت هنوز توسط فروشگاه فعال نشده است."
              : "برای رزرو پایان‌یافته، واریز تازه انجام ندهید."}
          </p>
        ))}
      {info?.payment && (
        <>
          <h3 className="font-bold">پرداخت کارت‌به‌کارت</h3>
          <p className="font-black">
            مبلغ نهایی: {formatToman(info.payment.amountToman)}
          </p>
          <p className="text-xs">
            ارسال: {formatToman(info.payment.shippingToman)} · مالیات ثبت‌شده:{" "}
            {formatToman(info.payment.taxToman)}
          </p>
          <p>
            بانک {info.payment.destination.bankName} · به نام{" "}
            {info.payment.destination.cardHolder}
          </p>
          <bdi className="block font-mono text-lg select-all">
            {info.payment.destination.cardNumber}
          </bdi>
          <p className="text-sm">
            گیرنده: {info.payment.shippingAddress.recipient} ·{" "}
            {info.payment.shippingAddress.city} ·{" "}
            {info.payment.shippingAddress.address} · کدپستی{" "}
            {info.payment.shippingAddress.postalCode}
          </p>
          <p role="status">
            {statuses[info.payment.status] || info.payment.status}
          </p>
          {info.payment.reviewReason && (
            <p className="text-sm">نتیجه بررسی: {info.payment.reviewReason}</p>
          )}
          <p className="text-xs">
            مهلت رزرو: {new Date(info.reservedUntil).toLocaleString("fa-IR")}؛
            پس از پایان مهلت یا لغو سفارش واریز نکنید. رسید به‌تنهایی تأیید
            پرداخت نیست.
          </p>
          {["AWAITING_TRANSFER", "REJECTED"].includes(info.payment.status) && (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-xs text-warning">
                فقط رسید واریز را بفرستید؛ عکس کارت، رمز، CVV2 یا کد یک‌بارمصرف
                نفرستید.
              </p>
              <label className="block text-xs">
                کد پیگیری واریز
                <input
                  required
                  minLength={4}
                  maxLength={80}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="block w-full border border-border bg-canvas-sunken rounded-lg p-2"
                />
              </label>
              <label className="block text-xs">
                تصویر رسید (JPEG، PNG یا WebP تا ۵ مگابایت)
                <input
                  required
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block mt-1"
                />
              </label>
              <button
                disabled={busy || !file}
                className="bg-buy text-buy-fg rounded-xl p-3"
              >
                ثبت خصوصی رسید برای بررسی
              </button>
            </form>
          )}
          {info.payment.hasReceipt && (
            <a
              href={"/api/payments/" + info.payment.id + "/receipt"}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline text-brand-600"
            >
              مشاهده رسید خودم
            </a>
          )}
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              load()
                .then(onChanged)
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
            className="underline text-sm"
          >
            بازخوانی وضعیت پرداخت و سفارش
          </button>
        </>
      )}
    </section>
  );
}
