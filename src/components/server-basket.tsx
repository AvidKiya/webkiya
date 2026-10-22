"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api, useAccount } from "@/lib/api";
import { faNumber, money } from "@/lib/catalog";
import { AccountPanel } from "./account-panel";
type Mode = "RETAIL" | "WHOLESALE";
type Cart = {
  cart: { id: string; version: number } | null;
  lines: {
    id: string;
    name: string;
    selection: string;
    quantity: number;
    unitsPerSelection: number;
  }[];
};
type Quote = {
  mode: Mode;
  cartVersion: number;
  validUntil: string;
  subtotalToman: string;
  lines: {
    lineId: string;
    name: string;
    selection: string;
    quantity: number;
    totalUnits: number;
    lineTotalToman: string;
  }[];
};
export function CartAddButton({
  mode,
  itemId,
  disabled = false,
}: {
  mode: Mode;
  itemId?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const retry = useRef<{ body: string; id: string } | null>(null);
  return (
    <div className="server-add">
      <button
        className="primary"
        disabled={busy || disabled || !itemId}
        onClick={async () => {
          const payload = { mode, itemId, quantity: 1 },
            body = JSON.stringify(payload);
          if (retry.current?.body !== body)
            retry.current = { body, id: crypto.randomUUID() };
          setBusy(true);
          setDone(false);
          setError("");
          try {
            await api("/api/cart", {
              method: "POST",
              body: JSON.stringify({ ...payload, requestId: retry.current.id }),
            });
            retry.current = null;
            setDone(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "در حال ثبت…"
          : disabled
            ? "ناموجود"
            : mode === "WHOLESALE"
              ? "افزودن یک جین به سبد سروری"
              : "افزودن به سبد سروری"}
      </button>
      {done ? (
        <p role="status">
          ثبت شد؛ <Link href="/basket">دیدن سبد سروری</Link>
        </p>
      ) : null}
      {error ? (
        <p role="alert">
          {error} <Link href="/account">حساب مشتری</Link>
        </p>
      ) : null}
    </div>
  );
}
export function ServerBasket() {
  const { account } = useAccount(),
    user = account?.user;
  const [mode, setMode] = useState<Mode>("RETAIL"),
    [nonce, setNonce] = useState(0),
    [state, setState] = useState<{
      userId: string;
      mode: Mode;
      data?: Cart;
      error?: string;
    } | null>(null),
    [quote, setQuote] = useState<{ userId: string; data: Quote } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now);
  const userId = user?.id,
    userKind = user?.kind;
  useEffect(() => {
    if (!userId || userKind !== "CUSTOMER") return;
    let active = true;
    api<Cart>("/api/cart?mode=" + mode)
      .then((data) => {
        if (active) setState({ userId, mode, data });
      })
      .catch((e) => {
        if (active) setState({ userId, mode, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [userId, userKind, mode, nonce]);
  useEffect(() => {
    const refresh = () => {
      setQuote(null);
      setNonce((n) => n + 1);
    };
    window.addEventListener("focus", refresh);
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, []);
  const own =
      state && state.userId === userId && state.mode === mode ? state : null,
    data = own?.data;
  const visibleQuote =
    quote &&
    quote.userId === userId &&
    quote.data.mode === mode &&
    quote.data.cartVersion === data?.cart?.version &&
    Date.parse(quote.data.validUntil) > clock
      ? quote.data
      : null;
  function refresh() {
    setQuote(null);
    setState(null);
    setError("");
    setNonce((n) => n + 1);
  }
  return (
    <main id="main" className="server-basket">
      <span className="eyebrow">KIYA / SERVER BASKET</span>
      <h1>سبد سروری و بررسی قیمت</h1>
      <nav>
        <Link href="/">بازگشت به ویترین</Link>
        <Link href="/wholesale">قیمت‌های اختصاصی همکار</Link>
        <Link href="/progress">نقشهٔ تکمیل</Link>
      </nav>
      <p className="demo-callout">
        این سبد در دیتابیس حساب شماست؛ از سبد محلی قبلی خودکار وارد نمی‌شود.
        محاسبهٔ قیمت، رزرو موجودی، سفارش یا مجوز پرداخت ایجاد نمی‌کند. ارسال و
        مالیات هنوز محاسبه نمی‌شوند.
      </p>
      {!user ? (
        <AccountPanel compact />
      ) : user.kind !== "CUSTOMER" ? (
        <p>
          برای سبد باید با حساب مشتری وارد شوید؛ نشست مدیریت مجوز خرید مشتری
          نیست.
        </p>
      ) : (
        <>
          {user.isDemo ? (
            <p className="micro">
              حساب مصنوعی آزمایشی؛ ورود پیامکی واقعی هنوز فعال نیست. کالاهای
              نمونه در سبد سروری قابل محاسبه نیستند.
            </p>
          ) : null}
          <div
            className="server-cart-tabs"
            role="group"
            aria-label="نوع سبد سروری"
          >
            <button
              className={mode === "RETAIL" ? "primary" : "secondary"}
              aria-pressed={mode === "RETAIL"}
              onClick={() => {
                setMode("RETAIL");
                setQuote(null);
                setError("");
              }}
            >
              سبد تکی
            </button>
            <button
              className={mode === "WHOLESALE" ? "primary" : "secondary"}
              aria-pressed={mode === "WHOLESALE"}
              onClick={() => {
                setMode("WHOLESALE");
                setQuote(null);
                setError("");
              }}
            >
              سبد عمده
            </button>
            <button className="secondary" onClick={refresh}>
              تازه‌سازی سبد سروری
            </button>
          </div>
          {!own ? <p role="status">در حال دریافت سبد…</p> : null}
          {own?.error ? <p role="alert">{own.error}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {data && !data.lines.length ? (
            <p>
              این سبد هنوز خالی است. کالای واقعی را از ویترین یا جین قیمت‌دار را
              از بخش اختصاصی همکار اضافه کنید.
            </p>
          ) : null}
          {data?.lines.map((line) => (
            <article className="server-cart-line" key={line.id}>
              <h2>{line.name}</h2>
              <p>
                {line.selection} · {faNumber(line.unitsPerSelection)} واحد در هر
                انتخاب · تعداد ثبت‌شده: {faNumber(line.quantity)}
              </p>
              <QuantityForm
                key={line.id + ":" + data.cart!.version}
                quantity={line.quantity}
                disabled={busy}
                submit={async (quantity, requestId) => {
                  setBusy(true);
                  setQuote(null);
                  setError("");
                  try {
                    await api("/api/cart", {
                      method: "PATCH",
                      body: JSON.stringify({
                        mode,
                        lineId: line.id,
                        quantity,
                        version: data.cart!.version,
                        requestId,
                      }),
                    });
                    refresh();
                    return true;
                  } catch (e) {
                    setError((e as Error).message);
                    return false;
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </article>
          ))}
          {data?.cart && data.lines.length ? (
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setQuote(null);
                setError("");
                try {
                  const result = await api<Quote>("/api/cart/quote", {
                    method: "POST",
                    body: JSON.stringify({ mode, version: data.cart!.version }),
                  });
                  setQuote({ userId: user.id, data: result });
                  setClock(Date.now());
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              بررسی موجودی و محاسبهٔ سروری
            </button>
          ) : null}
          {visibleQuote ? (
            <section className="server-quote" aria-label="نتیجه محاسبه سروری">
              <h2>
                جمع فعلی کالاها: {money(visibleQuote.subtotalToman)} تومان
              </h2>
              {visibleQuote.lines.map((l) => (
                <p key={l.lineId}>
                  {l.name} · {l.selection} · {faNumber(l.quantity)} انتخاب /{" "}
                  {faNumber(l.totalUnits)} واحد · {money(l.lineTotalToman)}{" "}
                  تومان
                </p>
              ))}
              <p>
                اعتبار نمایش این محاسبه تا{" "}
                {new Date(visibleQuote.validUntil).toLocaleString("fa-IR")}؛ هر
                اقدام بعدی باید دوباره بررسی شود.
              </p>
              <strong>
                بدون رزرو و بدون سفارش؛ مبلغ قابل پرداخت هنوز تعیین نشده است.
              </strong>
            </section>
          ) : quote ? (
            <p role="status">
              محاسبهٔ قبلی منقضی یا سبد تغییر کرده؛ دوباره بررسی کنید.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
function QuantityForm({
  quantity,
  disabled,
  submit,
}: {
  quantity: number;
  disabled: boolean;
  submit: (quantity: number, requestId: string) => Promise<boolean>;
}) {
  const retry = useRef<{ quantity: number; id: string } | null>(null);
  return (
    <form
      className="server-quantity"
      onSubmit={async (e) => {
        e.preventDefault();
        const next = Number(new FormData(e.currentTarget).get("quantity"));
        if (retry.current?.quantity !== next)
          retry.current = { quantity: next, id: crypto.randomUUID() };
        await submit(next, retry.current.id);
      }}
    >
      <label>
        تعداد انتخاب (صفر برای حذف)
        <input
          name="quantity"
          type="number"
          min={0}
          max={1000}
          step={1}
          required
          defaultValue={quantity}
        />
      </label>
      <button className="secondary" disabled={disabled}>
        ثبت تعداد در سرور
      </button>
    </form>
  );
}
