import { useEffect, useRef, useState } from "react";
import { ManualPaymentView } from "./ManualPaymentView";
import { TelegramLogin } from "./TelegramLogin";
import { api } from "../../services/catalog";
type User = {
  id: string;
  name: string;
  kind: string;
  isDemo: boolean;
  canShop: boolean;
  adminAccess: boolean;
};
type Session = {
  user: User | null;
  demoLoginAvailable: boolean;
  smsConfigured: boolean;
  telegramLoginAvailable: boolean;
};
type Order = {
  id: string;
  mode: string;
  status: string;
  version: number;
  subtotalToman: string;
  reservedUntil: string | null;
  shipment: {
    status: string;
    carrier: string;
    trackingCode: string;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
};
export function CustomerAccount() {
  const [session, setSession] = useState<Session | null>(null),
    [orders, setOrders] = useState<Order[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [ordersLoaded, setOrdersLoaded] = useState(false);
  const generation = useRef(0);
  async function load() {
    const ticket = ++generation.current;
    setOrders([]);
    setOrdersLoaded(false);
    const me = await api<Session>("/api/auth/me");
    if (ticket !== generation.current) return;
    setSession(me);
    setOrders([]);
    if (me.user?.canShop) {
      const list = await api<{ orders: Order[] }>("/api/orders");
      if (ticket === generation.current) {
        setOrders(list.orders);
        setOrdersLoaded(true);
      }
    }
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    return () => {
      generation.current++;
    };
  }, []);
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    generation.current++;
    setOrders([]);
    setOrdersLoaded(false);
    setBusy(true);
    setMessage("");
    try {
      await action();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="max-w-[800px] mx-auto bg-surface border border-border rounded-2xl p-5 space-y-4">
      <h1 className="font-black text-xl">حساب و سفارش‌های من</h1>
      {!session && !message && <p role="status">در حال بررسی نشست…</p>}
      {message && (
        <p role="alert" className="text-danger">
          {message}
        </p>
      )}
      {session?.user ? (
        <>
          <p>
            حساب: {session.user.name}{" "}
            {session.user.isDemo && "— آزمایشی؛ تأیید شمارهٔ واقعی نیست"}
          </p>
          <button
            disabled={busy}
            onClick={() => run(() => api("/api/auth/logout", {}))}
            className="border border-border rounded-xl p-3"
          >
            خروج از حساب
          </button>
        </>
      ) : (
        session && (
          <>
            <p>برای خرید وارد حساب مشتری شوید.</p>
            <TelegramLogin onLogin={load} />
            {session.demoLoginAvailable && (
              <button
                disabled={busy}
                onClick={() => run(() => api("/api/auth/demo", {}))}
                className="bg-buy text-buy-fg rounded-xl p-3"
              >
                ورود آزمایشی محلی؛ بدون تأیید شماره
              </button>
            )}
          </>
        )
      )}
      {session?.user?.adminAccess && (
        <a
          href="/admin"
          className="block bg-brand-500 text-white rounded-xl p-3 text-center font-bold"
        >
          پنل مدیریت
        </a>
      )}
      <h2 className="font-bold">سفارش‌های سروری</h2>
      {session?.user?.canShop && !ordersLoaded && !message && (
        <p role="status">در حال دریافت سفارش‌ها…</p>
      )}
      {session?.user?.canShop && ordersLoaded && orders.length === 0 && (
        <p>سفارشی در حساب شما وجود ندارد.</p>
      )}
      {session?.user?.canShop &&
        orders.map((order) => (
          <article
            key={order.id}
            className="border border-border rounded-xl p-3 space-y-2"
          >
            <p>
              شناسه: <bdi>{order.id}</bdi>
            </p>
            <p>
              وضعیت: {order.status} — جمع کالا: {order.subtotalToman} تومان
            </p>
            <p>
              رزرو به معنی پرداخت‌شدن نیست؛ وضعیت و روش پرداخت را در بخش زیر
              بررسی کنید.
            </p>
            {order.status === "PAID" && (
              <section
                aria-label="پیگیری ارسال"
                className="rounded-xl bg-canvas-sunken p-3 space-y-2"
              >
                <h2 className="font-bold">پیگیری ارسال سفارش</h2>
                <p>
                  {!order.shipment
                    ? "پرداخت تأیید شده؛ منتظر شروع آماده‌سازی"
                    : order.shipment.status === "PREPARING"
                      ? "در حال آماده‌سازی و بسته‌بندی"
                      : order.shipment.status === "SHIPPED"
                        ? "تحویل به شرکت حمل ثبت شده است"
                        : "تحویل به گیرنده توسط مسئول ارسال ثبت شده است"}
                </p>
                {order.shipment?.trackingCode && (
                  <p>
                    شرکت حمل: {order.shipment.carrier} · کد رهگیری:{" "}
                    <bdi>{order.shipment.trackingCode}</bdi>
                  </p>
                )}
                {order.shipment?.shippedAt && (
                  <p>
                    زمان ثبت ارسال:{" "}
                    {new Date(order.shipment.shippedAt).toLocaleString("fa-IR")}
                  </p>
                )}
                {order.shipment?.deliveredAt && (
                  <p>
                    زمان ثبت تحویل:{" "}
                    {new Date(order.shipment.deliveredAt).toLocaleString(
                      "fa-IR",
                    )}
                  </p>
                )}
              </section>
            )}
            <ManualPaymentView orderId={order.id} onChanged={load} />
            {order.status === "RESERVED" && (
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    api("/api/orders/" + order.id + "/cancel", {
                      version: order.version,
                    }),
                  )
                }
                className="text-danger underline"
              >
                لغو رزرو و آزادسازی موجودی
              </button>
            )}
          </article>
        ))}
      <p className="text-xs text-ink-500">
        کیف پول و گردونهٔ مالی فعال نیستند؛ اعتبار نمونه به‌عنوان پول
        قابل‌استفاده نمایش داده نمی‌شود.
      </p>
    </section>
  );
}
