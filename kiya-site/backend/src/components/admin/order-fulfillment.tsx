"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import "./integration-settings.css";
type Shipment = {
  status: string;
  version: number;
  carrier: string;
  trackingCode: string;
};
type Order = {
  id: string;
  mode: string;
  amountToman: string | null;
  createdAt: string;
  shippingAddress: {
    recipient?: string;
    phone?: string;
    city?: string;
    address?: string;
    postalCode?: string;
  } | null;
  shipment: Shipment | null;
  snapshot: {
    lines?: {
      itemId: string;
      name: string;
      selection: string;
      quantity: number;
      components?: { name: string; unitsPerSelection: number }[];
    }[];
  };
};
type Listing = {
  canManage: boolean;
  items: Order[];
  page: number;
  hasMore: boolean;
};
const labels: Record<string, string> = {
  UNSTARTED: "منتظر آماده‌سازی",
  PREPARING: "در حال آماده‌سازی",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل ثبت‌شده",
};
export function OrderFulfillment() {
  const [listing, setListing] = useState<Listing | null>(null),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState("ALL"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api<Listing>(`/api/admin/orders?page=${page}&status=${filter}`)
      .then((value) => {
        if (active) {
          setListing(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setListing(null);
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [page, filter, revision]);
  async function submit(event: React.FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form),
      action =
        order.shipment?.status === "PREPARING"
          ? "ship"
          : order.shipment?.status === "SHIPPED"
            ? "deliver"
            : "prepare";
    if (action === "deliver" && !data.get("confirmed")) {
      setError("تحویل را فقط براساس تأیید واقعی گیرنده یا شرکت حمل ثبت کنید.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/orders/${order.id}`, {
        method: "POST",
        body: JSON.stringify({
          action,
          version: order.shipment?.version ?? 0,
          reason: data.get("reason"),
          ...(action === "ship"
            ? {
                carrier: data.get("carrier"),
                trackingCode: data.get("trackingCode"),
              }
            : {}),
        }),
      });
      form.reset();
      setListing(null);
      setRevision((v) => v + 1);
      setNotice("وضعیت سفارش ثبت شد.");
    } catch (e) {
      setListing(null);
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="integration-settings" dir="rtl">
      <Link href="/admin">بازگشت به مدیریت</Link>
      <h1>پردازش و ارسال سفارش‌ها</h1>
      <p>
        فقط سفارش‌های پرداخت‌تأییدشده. ثبت ارسال جای تحویل واقعی مرسوله به شرکت
        حمل نیست؛ ثبت تحویل نیازمند تأیید واقعی است.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label>
        وضعیت سفارش
        <select
          value={filter}
          disabled={busy}
          onChange={(e) => {
            setListing(null);
            setPage(1);
            setFilter(e.target.value);
          }}
        >
          <option value="ALL">همهٔ پرداخت‌شده‌ها</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() => {
          setListing(null);
          setRevision((v) => v + 1);
        }}
      >
        تازه‌سازی سفارش‌ها
      </button>
      {!listing && !error && <p role="status">در حال دریافت سفارش‌ها…</p>}
      {listing?.items.length === 0 && <p>سفارشی در این وضعیت نیست.</p>}
      {listing?.items.map((order) => (
        <article key={order.id} data-testid="fulfillment-order">
          <h2>
            سفارش <bdi>{order.id}</bdi>
          </h2>
          <p>
            {order.mode === "WHOLESALE" ? "عمده" : "خرده"} ·{" "}
            {labels[order.shipment?.status ?? "UNSTARTED"]} · پرداخت:{" "}
            {order.amountToman ?? "—"} تومان
          </p>
          {order.snapshot.lines && (
            <ul aria-label="اقلام بسته‌بندی">
              {order.snapshot.lines.map((line, index) => (
                <li key={index}>
                  <strong>{line.name}</strong> · {line.selection} · تعداد:{" "}
                  {line.quantity}
                  {line.components?.map((c, i) => (
                    <span key={i}>
                      {" "}
                      · {c.name}: {c.unitsPerSelection * line.quantity}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {order.shippingAddress && (
            <address style={{ fontStyle: "normal" }}>
              {order.shippingAddress.recipient} ·{" "}
              <bdi>{order.shippingAddress.phone}</bdi>
              <br />
              {order.shippingAddress.city}، {order.shippingAddress.address}
              <br />
              کد پستی: <bdi>{order.shippingAddress.postalCode}</bdi>
            </address>
          )}
          {order.shipment?.trackingCode && (
            <p>
              حمل: {order.shipment.carrier} · رهگیری:{" "}
              <bdi>{order.shipment.trackingCode}</bdi>
            </p>
          )}
          {listing.canManage && order.shipment?.status !== "DELIVERED" && (
            <form onSubmit={(event) => void submit(event, order)}>
              {order.shipment?.status === "PREPARING" && (
                <>
                  <label>
                    شرکت حمل
                    <input
                      name="carrier"
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    کد رهگیری
                    <input
                      name="trackingCode"
                      dir="ltr"
                      pattern={String.raw`[A-Za-z0-9][A-Za-z0-9\x2F\x2D]{3,79}`}
                      maxLength={80}
                      required
                    />
                  </label>
                </>
              )}
              {order.shipment?.status === "SHIPPED" && (
                <label>
                  <input name="confirmed" type="checkbox" required />
                  تحویل به گیرنده با مدرک یا گزارش حمل تأیید شده است
                </label>
              )}
              <label>
                دلیل و مستند عملیات
                <textarea
                  name="reason"
                  minLength={10}
                  maxLength={500}
                  required
                />
              </label>
              <button disabled={busy} type="submit">
                {!order.shipment
                  ? "شروع آماده‌سازی"
                  : order.shipment.status === "PREPARING"
                    ? "ثبت ارسال و رهگیری"
                    : "ثبت تحویل به گیرنده"}
              </button>
            </form>
          )}
        </article>
      ))}
      <nav aria-label="صفحه‌های سفارش">
        <button
          disabled={busy || page === 1}
          onClick={() => {
            setListing(null);
            setPage((v) => v - 1);
          }}
        >
          صفحهٔ قبل
        </button>
        <span> صفحهٔ {page} </span>
        <button
          disabled={busy || !listing?.hasMore}
          onClick={() => {
            setListing(null);
            setPage((v) => v + 1);
          }}
        >
          صفحهٔ بعد
        </button>
      </nav>
    </main>
  );
}
