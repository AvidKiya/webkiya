import { useEffect, useRef, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { api } from "../../services/catalog";
type Cart = {
  cart: { id: string; version: number } | null;
  lines: { id: string; quantity: number; name: string; selection: string }[];
};
type Quote = {
  fingerprint: string;
  cartVersion: number;
  subtotalToman: string;
  validUntil: string;
};
export function ServerCart() {
  const { cartSheetOpen, setCartSheetOpen, salesMode, setRoute } = useStore();
  const [data, setData] = useState<Cart | null>(null),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false);
  const attempt = useRef<string | null>(null);
  const alive = useRef(true),
    privacy = useRef(0),
    reads = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      privacy.current++;
      reads.current++;
    };
  }, []);
  const dialog = useRef<HTMLElement>(null);
  async function refresh() {
    if (!alive.current) return;
    const ticket = ++reads.current;
    setQuote(null);
    setConsent(false);
    attempt.current = null;
    setData(null);
    const next = await api<Cart>("/api/cart?mode=" + salesMode);
    if (alive.current && ticket === reads.current && !document.hidden)
      setData(next);
  }
  useEffect(() => {
    if (!cartSheetOpen) return;
    const clear = () => {
      privacy.current++;
      reads.current++;
      setData(null);
      setError("");
      setQuote(null);
      setConsent(false);
    };
    const reload = () => {
      clear();
      if (!document.hidden)
        refresh().catch((e) => {
          if (alive.current && !document.hidden) setError(e.message);
        });
    };
    reload();
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [cartSheetOpen, salesMode]);
  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(
      () => {
        setQuote(null);
        setConsent(false);
        setError("اعتبار محاسبه پایان یافت؛ قیمت جاری را دوباره دریافت کنید.");
      },
      Math.max(0, Date.parse(quote.validUntil) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [quote]);
  useEffect(() => {
    if (!cartSheetOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setCartSheetOpen(false);
      }
      if (event.key === "Tab") {
        const nodes = [
          ...dialog.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), a[href]",
          ),
        ].filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (!first) {
          event.preventDefault();
          dialog.current?.focus();
        } else if (
          !dialog.current?.contains(document.activeElement) ||
          document.activeElement === dialog.current ||
          (event.shiftKey
            ? document.activeElement === first
            : document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [cartSheetOpen, setCartSheetOpen]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  if (!cartSheetOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[115] bg-black/60 flex items-end md:items-center justify-center p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCartSheetOpen(false);
      }}
    >
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="سبد سروری"
        className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-surface rounded-2xl p-5 space-y-4"
      >
        <div className="flex justify-between">
          <h2 className="font-black">
            سبد سروری {salesMode === "WHOLESALE" ? "عمده" : "تکی"}
          </h2>
          <button onClick={() => setCartSheetOpen(false)} aria-label="بستن سبد">
            بستن
          </button>
        </div>
        {error && (
          <p role="alert" className="text-danger">
            {error}
            <button
              disabled={busy}
              className="underline block"
              onClick={() => run(refresh)}
            >
              دریافت دوبارهٔ سبد از سرور
            </button>
          </p>
        )}
        {!data && !error && <p role="status">در حال دریافت سبد…</p>}
        {data?.lines.length === 0 && <p>سبد سروری خالی است.</p>}
        {data?.lines.map((line) => (
          <article
            key={line.id}
            className="border border-border rounded-xl p-3"
          >
            <p className="font-bold">{line.name}</p>
            <p>
              {line.selection} — تعداد: {line.quantity}
            </p>
            <div className="flex gap-4 my-2">
              {[-1, 1].map((delta) => (
                <button
                  key={delta}
                  aria-label={
                    (delta < 0 ? "کاهش تعداد " : "افزایش تعداد ") + line.name
                  }
                  disabled={
                    busy ||
                    (delta < 0 ? line.quantity <= 1 : line.quantity >= 1000)
                  }
                  className="border border-border px-3 rounded-lg disabled:opacity-40"
                  onClick={() =>
                    run(async () => {
                      await api(
                        "/api/cart",
                        {
                          mode: salesMode,
                          lineId: line.id,
                          quantity: line.quantity + delta,
                          version: data.cart!.version,
                          requestId: crypto.randomUUID(),
                        },
                        "PATCH",
                      );
                      await refresh();
                    })
                  }
                >
                  {delta < 0 ? "−" : "+"}
                </button>
              ))}
            </div>
            <button
              disabled={busy}
              className="text-danger underline"
              onClick={() =>
                run(async () => {
                  await api(
                    "/api/cart",
                    {
                      mode: salesMode,
                      lineId: line.id,
                      quantity: 0,
                      version: data.cart!.version,
                      requestId: crypto.randomUUID(),
                    },
                    "PATCH",
                  );
                  await refresh();
                })
              }
            >
              حذف از سبد
            </button>
          </article>
        ))}
        {!!data?.lines.length && (
          <button
            disabled={busy}
            className="bg-buy text-buy-fg rounded-xl p-3"
            onClick={() =>
              run(async () => {
                setConsent(false);
                attempt.current = null;
                const ticket = privacy.current;
                const next = await api<Quote>("/api/cart/quote", {
                  mode: salesMode,
                  version: data.cart!.version,
                });
                if (
                  alive.current &&
                  ticket === privacy.current &&
                  !document.hidden
                )
                  setQuote(next);
              })
            }
          >
            محاسبهٔ قیمت جاری از سرور
          </button>
        )}
        {quote && (
          <div className="border border-border rounded-xl p-3 space-y-3">
            <p>جمع کالا: {quote.subtotalToman} تومان</p>
            <p>
              هزینهٔ ارسال و مبلغ نهایی در مرحلهٔ ثبت نشانی و انتخاب پرداخت
              تعیین می‌شوند. این محاسبه موجودی را رزرو نمی‌کند.
            </p>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              رزرو موقت بدون پرداخت را می‌پذیرم؛ خرید نهایی نیست.
            </label>
            <button
              disabled={
                busy || !consent || Date.now() >= Date.parse(quote.validUntil)
              }
              className="bg-buy text-buy-fg rounded-xl p-3 disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  attempt.current ??= crypto.randomUUID();
                  await api("/api/orders", {
                    mode: salesMode,
                    version: quote.cartVersion,
                    fingerprint: quote.fingerprint,
                    requestId: attempt.current,
                  });
                  if (alive.current) {
                    setCartSheetOpen(false);
                    setRoute("account");
                  }
                })
              }
            >
              ایجاد رزرو موقت بدون پرداخت
            </button>
          </div>
        )}
        <button
          className="text-brand-500 underline"
          onClick={() => {
            setCartSheetOpen(false);
            setRoute("account");
          }}
        >
          ورود و مشاهدهٔ سفارش‌ها
        </button>
        <p className="text-xs text-ink-500">
          برای پرداخت کارت‌به‌کارت، پس از رزرو به حساب و سفارش‌ها بروید. مبلغ
          فقط در سرور محاسبه می‌شود.
        </p>
      </section>
    </div>
  );
}
