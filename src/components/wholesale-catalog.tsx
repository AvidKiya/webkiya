"use client";
import { useEffect, useState } from "react";
import { api, useAccount } from "@/lib/api";
import { faNumber, money } from "@/lib/catalog";
type Item = {
  offerId: string;
  product: {
    id: string;
    name: string;
    retailPriceToman: string;
    isDemo: boolean;
  };
  pack: {
    label: string;
    unitsPerPack: number;
    components: { name: string; units: number }[];
  };
  pricing: string;
  unitPriceToman?: string;
  packPriceToman?: string;
  validUntil: string | null;
  available: boolean;
};
type Catalog = { items: Item[]; accessExpiresAt: string | null };
export function WholesaleCatalog() {
  const { account } = useAccount();
  const user = account?.user;
  const [state, setState] = useState<{
      userId: string;
      data?: Catalog;
      error?: string;
    } | null>(null),
    [nonce, setNonce] = useState(0),
    [clock, setClock] = useState(Date.now);
  const userId = user?.id,
    userKind = user?.kind;
  useEffect(() => {
    if (!userId || userKind !== "CUSTOMER") return;
    let active = true,
      sequence = 0;
    const fetchData = () => {
      const ticket = ++sequence;
      api<Catalog>("/api/wholesale/catalog")
        .then((data) => {
          if (active && ticket === sequence) setState({ userId, data });
        })
        .catch((e) => {
          if (active && ticket === sequence)
            setState({ userId, error: e.message });
        });
    };
    const load = () => {
      setState(null);
      fetchData();
    };
    fetchData();
    window.addEventListener("focus", load);
    const poll = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(poll);
      window.removeEventListener("focus", load);
    };
  }, [userId, userKind, nonce]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!user || user.kind !== "CUSTOMER")
    return (
      <section className="surface private-wholesale">
        <h2>قیمت اختصاصی همکار</h2>
        <p>
          فقط حساب مشتری با همکاری معتبر و قیمت تخصیص‌یافته می‌تواند قیمت خصوصی
          را ببیند. تغییر حالت صفحه مجوز ایجاد نمی‌کند.
        </p>
      </section>
    );
  const own = state?.userId === user.id ? state : null;
  const data = own?.data;
  const now = clock;
  const expired =
    !!data?.accessExpiresAt && Date.parse(data.accessExpiresAt) <= now;
  const items = expired
    ? []
    : data?.items.filter(
        (i) => !i.validUntil || Date.parse(i.validUntil) > now,
      ) || [];
  return (
    <section className="surface private-wholesale">
      <h2>قیمت‌های اختصاصی حساب شما</h2>
      <p>
        حداقل یک جین؛ بدون کف مبلغ اضافه. نمایش قیمت اجازهٔ سفارش یا پرداخت
        نیست؛ سبد سروری هنوز فعال نشده است.
      </p>
      {user.isDemo ? (
        <small>حساب مصنوعی آزمایشی؛ این نما تأیید هویت واقعی نیست.</small>
      ) : null}
      <button
        className="secondary"
        onClick={() => {
          setState(null);
          setNonce((n) => n + 1);
        }}
      >
        بررسی دوبارهٔ دسترسی و قیمت‌ها
      </button>
      {!own ? <p role="status">در حال بررسی دسترسی…</p> : null}
      {own?.error ? <p role="alert">{own.error}</p> : null}
      {data && !items.length ? (
        <p>
          {expired
            ? "اعتبار همکاری پایان یافته؛ با پشتیبانی تماس بگیرید."
            : "قیمت معتبر تخصیص‌یافته‌ای ندارید؛ برای قیمت عمده با پشتیبانی تماس بگیرید."}
        </p>
      ) : null}
      {items.map((i) => (
        <article className="private-price-card" key={i.offerId}>
          <h3>
            {i.product.name} · {i.pack.label}
          </h3>
          <p>
            {faNumber(i.pack.unitsPerPack)} واحد در یک جین ·{" "}
            {i.available
              ? "موجودی اولیهٔ یک جین کافی است؛ رزرو نشده"
              : "فعلاً موجودی یک جین کافی نیست"}
          </p>
          <p>
            {i.pack.components
              .map((c) => c.name + " × " + faNumber(c.units))
              .join(" · ")}
          </p>
          <p>قیمت تکی سایت: {money(i.product.retailPriceToman)} تومان</p>
          {i.pricing === "PRICED" && i.unitPriceToman && i.packPriceToman ? (
            <>
              <p>
                قیمت عمدهٔ هر واحد:{" "}
                <strong>{money(i.unitPriceToman)} تومان</strong>
              </p>
              <p>
                قیمت یک جین: <strong>{money(i.packPriceToman)} تومان</strong>
              </p>
            </>
          ) : (
            <p>قیمت این جین فقط با استعلام ارائه می‌شود.</p>
          )}
          <small>
            اعتبار قیمت:{" "}
            {i.validUntil
              ? new Date(i.validUntil).toLocaleString("fa-IR")
              : "تا بایگانی یا تغییر دسترسی"}{" "}
            · بدون ثبت سفارش
          </small>
        </article>
      ))}
    </section>
  );
}
