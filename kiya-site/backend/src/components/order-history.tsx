"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/catalog";
type Order = {
  id: string;
  mode: string;
  status: string;
  version: number;
  reservedUntil: string;
  subtotalToman: string;
  createdAt: string;
  snapshot: {
    lines: {
      lineId: string;
      name: string;
      selection: string;
      quantity: number;
      lineTotalToman: string;
    }[];
  };
};
export function OrderHistory({ nonce }: { nonce: number }) {
  const [data, setData] = useState<Order[] | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    let cancelled = false;
    api<{ orders: Order[] }>("/api/orders")
      .then((d) => {
        if (!cancelled) {
          setData(d.orders);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nonce, revision]);
  useEffect(() => {
    const tick = setInterval(() => {
      setClock(Date.now());
      setRevision((v) => v + 1);
    }, 30000);
    const focus = () => {
      setClock(Date.now());
      setRevision((v) => v + 1);
    };
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(tick);
      window.removeEventListener("focus", focus);
    };
  }, []);
  return (
    <section aria-label="سفارش‌های اولیه من" className="order-history">
      <h2>سفارش‌های اولیه و رزروهای من</h2>
      <p className="micro">
        آخرین ۵۰ مورد؛ بدون پرداخت، تأیید نهایی فروش یا اجازهٔ ارسال. انقضای
        رزرو با تازه‌سازی بررسی می‌شود.
      </p>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => setRevision((v) => v + 1)}
      >
        تازه‌سازی سفارش‌ها
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {!data && !error ? (
        <p role="status">در حال دریافت سفارش‌ها…</p>
      ) : data && !data.length ? (
        <p>هنوز سفارش اولیه‌ای ثبت نشده است.</p>
      ) : null}
      {data?.map((o) => (
        <article className="server-cart-line" key={o.id}>
          <h3>سفارش {o.id}</h3>
          <p>
            {o.mode === "WHOLESALE" ? "عمده" : "تکی"} · وضعیت:{" "}
            {o.status === "RESERVED"
              ? Date.parse(o.reservedUntil) <= clock
                ? "مهلت تمام شده؛ منتظر آزادسازی"
                : "رزرو فعال"
              : o.status === "CANCELLED"
                ? "لغوشده"
                : "منقضی‌شده"}
          </p>
          <p>جمع ثبت‌شدهٔ کالاها: {money(o.subtotalToman)} تومان</p>
          {o.snapshot.lines.map((l) => (
            <p key={l.lineId}>
              {l.name} · {l.selection} · تعداد{" "}
              {l.quantity.toLocaleString("fa-IR")} · {money(l.lineTotalToman)}{" "}
              تومان
            </p>
          ))}
          <p>پایان مهلت: {new Date(o.reservedUntil).toLocaleString("fa-IR")}</p>
          {o.status === "RESERVED" ? (
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api("/api/orders/" + o.id + "/cancel", {
                    method: "POST",
                    body: JSON.stringify({ version: o.version }),
                  });
                  setRevision((v) => v + 1);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              لغو سفارش و آزادسازی رزرو
            </button>
          ) : null}
        </article>
      ))}
    </section>
  );
}
