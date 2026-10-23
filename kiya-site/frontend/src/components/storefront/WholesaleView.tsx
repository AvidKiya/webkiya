import { useCallback, useEffect, useRef, useState } from "react";
import {
  Layers,
  Building2,
  Send,
  Lock,
  Minus,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { api } from "../../services/catalog";
import {
  accessExpired,
  offerExpired,
  formatToman,
  parseWholesaleCatalog,
  type PartnerApplicationDTO,
  type CustomerIdentity,
  type WholesaleCatalog,
  type WholesaleOffer,
} from "../../services/wholesale";
import { formatNumber } from "../../utils/format";
type State = {
  user: CustomerIdentity | null;
  application: PartnerApplicationDTO | null;
};
function statusLabel(app: PartnerApplicationDTO) {
  if (accessExpired(app)) return "اعتبار همکاری پایان یافته";
  return (
    {
      PENDING: "در انتظار بررسی پشتیبانی",
      APPROVED: "همکار تأییدشده",
      REJECTED: "درخواست رد شده",
      SUSPENDED: "دسترسی تعلیق‌شده",
    }[app.status] || "نامشخص"
  );
}
export function WholesaleView() {
  const { setRoute, openServerCart, showToast } = useStore();
  const [state, setState] = useState<State | null>(null),
    [catalog, setCatalog] = useState<WholesaleCatalog | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [businessName, setBusinessName] = useState(""),
    [city, setCity] = useState(""),
    [note, setNote] = useState("");
  const generation = useRef(0),
    mounted = useRef(true),
    mutation = useRef(false),
    attempts = useRef(
      new Map<string, { quantity: number; requestId: string }>(),
    );
  const load = useCallback(async () => {
    const ticket = ++generation.current;
    setCatalog(null);
    setState(null);
    setError("");
    const fresh = () => mounted.current && ticket === generation.current;
    try {
      const me = await api<{ user: CustomerIdentity | null }>("/api/auth/me");
      if (!fresh()) return;
      if (!me.user) {
        setState({ user: null, application: null });
        return;
      }
      if (me.user.kind !== "CUSTOMER") {
        setState({ user: me.user, application: null });
        setError(
          "این بخش مخصوص حساب مشتری است؛ حساب کارکنان مجوز خرید همکار ندارد.",
        );
        return;
      }
      const own = await api<{ application: PartnerApplicationDTO | null }>(
        "/api/partner",
      );
      if (!fresh()) return;
      setState({ user: me.user, application: own.application });
      if (
        own.application?.status === "APPROVED" &&
        !accessExpired(own.application)
      ) {
        const response = await api<unknown>("/api/wholesale/catalog");
        if (!fresh()) return;
        const parsed = parseWholesaleCatalog(response);
        if (accessExpired({ expiresAt: parsed.accessExpiresAt }))
          throw new Error("اعتبار همکاری پایان یافته است.");
        setCatalog({
          ...parsed,
          items: parsed.items.filter((o) => !offerExpired(o)),
        });
      }
    } catch (e) {
      if (fresh()) {
        setCatalog(null);
        setError(e instanceof Error ? e.message : "ارتباط با سرور ناموفق بود.");
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load();
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(scheduled);
      scheduled = setTimeout(() => {
        if (document.visibilityState === "visible" && !mutation.current)
          void load();
      }, 40);
    };
    const visibility = () => {
      if (document.hidden) {
        generation.current++;
        setCatalog(null);
        setState(null);
      } else refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("kiya-session-changed", refresh);
    document.addEventListener("visibilitychange", visibility);
    const poll = setInterval(refresh, 15000);
    return () => {
      mounted.current = false;
      generation.current++;
      clearTimeout(scheduled);
      clearInterval(poll);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("kiya-session-changed", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load]);
  useEffect(() => {
    if (!catalog) return;
    const dates = [
      catalog.accessExpiresAt,
      ...catalog.items.map((o) => o.validUntil),
    ]
      .filter((v): v is string => !!v)
      .map(Date.parse);
    if (!dates.length) return;
    const timer = setTimeout(
      () => {
        if (accessExpired({ expiresAt: catalog.accessExpiresAt })) {
          setCatalog(null);
          setError("اعتبار همکاری پایان یافت؛ قیمت‌های خصوصی پنهان شدند.");
        } else {
          setCatalog((prev) =>
            prev
              ? { ...prev, items: prev.items.filter((o) => !offerExpired(o)) }
              : null,
          );
        }
      },
      Math.max(0, Math.min(...dates) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [catalog]);
  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.current) return;
    mutation.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await api("/api/partner", {
        businessName: businessName.trim(),
        city: city.trim(),
        note: note.trim(),
      });
      if (mounted.current) {
        setNotice("درخواست در سرور ثبت شد؛ تأیید مستقل پشتیبانی لازم است.");
        await load();
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "ثبت درخواست ناموفق بود.");
    } finally {
      mutation.current = false;
      if (mounted.current) setPending(false);
    }
  }
  async function add(offer: WholesaleOffer) {
    if (mutation.current) return;
    if (
      !catalog ||
      accessExpired({ expiresAt: catalog.accessExpiresAt }) ||
      offerExpired(offer)
    ) {
      await load();
      return;
    }
    const quantity = counts[offer.offerId] || 1;
    mutation.current = true;
    setPending(true);
    setError("");
    const previous = attempts.current.get(offer.offerId);
    const attempt =
      previous?.quantity === quantity
        ? previous
        : { quantity, requestId: crypto.randomUUID() };
    attempts.current.set(offer.offerId, attempt);
    try {
      await api("/api/cart", {
        mode: "WHOLESALE",
        itemId: offer.pack.id,
        quantity,
        requestId: attempt.requestId,
      });
      attempts.current.delete(offer.offerId);
      if (mounted.current) {
        showToast(
          "جین واقعی در سبد سروری ثبت شد؛ هنوز پرداخت یا رزرو نشده است.",
          "success",
        );
        openServerCart("WHOLESALE");
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "افزودن ناموفق بود؛ برای تکرار امن همان تعداد را دوباره ارسال کنید.",
        );
    } finally {
      mutation.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const quantity = (id: string, delta: number) =>
    setCounts((prev) => ({
      ...prev,
      [id]: Math.min(1000, Math.max(1, (prev[id] || 1) + delta)),
    }));
  return (
    <div className="w-full max-w-[960px] mx-auto space-y-5">
      {/* Policy Hero Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#482780] via-[#381C68] to-[#211A2B] text-white p-6 shadow-e3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gold-500 text-[#211A2B] flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black">
                سامانه عمده‌فروشی جینی و حساب همکاران کیا
              </h1>
              <p className="text-xs text-white/80">
                تأمین مستقیم فروشگاه‌ها و پیج‌های سراسر کشور از انبار مرکزی کیا
              </p>
            </div>
          </div>

          <span className="px-3 py-1.5 rounded-xl bg-white/15 text-xs font-extrabold border border-white/20">
            وضعیت حساب شما:{" "}
            {state?.application
              ? statusLabel(state.application)
              : state?.user
                ? "بدون پرونده همکاری"
                : state
                  ? "وارد نشده"
                  : "در حال بررسی سرور"}
          </span>
        </div>

        {/* Owner Confirmed Wholesale Rules */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
            <p className="font-extrabold text-gold-300">
              حداقل خرید: فقط ۱ جین
            </p>
            <p className="text-white/80 mt-0.5">
              گام افزایش ۱ جین کامل؛ بدون تحمیل حداقل مبلغ اضافه یا شرط دو و سه
              جین.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
            <p className="font-extrabold text-gold-300">محرمانگی نرخ همکار</p>
            <p className="text-white/80 mt-0.5">
              قیمت عمده هرگز در نمای عمومی، سئو یا کانال عمومی افشا نمی‌شود تا
              حاشیه سود همکار حفظ گردد.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
            <p className="font-extrabold text-gold-300">
              ترکیب شفاف هر جین (BOM)
            </p>
            <p className="text-white/80 mt-0.5">
              تعداد واحد داخل هر بسته (۴، ۶، ۸، ۱۰ یا ۱۲ تایی) دقیقاً بر اساس
              مشخصات همان کالا محاسبه می‌شود.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <button
          disabled={pending}
          onClick={() => void load()}
          className="px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold"
        >
          دریافت وضعیت و قیمت جاری
        </button>
        {state?.user?.kind === "CUSTOMER" && (
          <button
            onClick={() => openServerCart("WHOLESALE")}
            className="px-4 py-2 rounded-xl bg-brand-50 text-brand-600 text-xs font-bold"
          >
            مشاهدهٔ سبد عمده
          </button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="p-4 rounded-xl border border-danger text-danger text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="p-4 rounded-xl border border-success text-sm"
        >
          {notice}
        </p>
      )}
      {!state && !error && (
        <p role="status">در حال خواندن وضعیت همکاری از سرور…</p>
      )}
      {state && !state.user && (
        <section className="bg-surface border border-border rounded-2xl p-5 space-y-3">
          <h2 className="font-extrabold">
            برای ثبت درخواست همکاری وارد حساب شوید
          </h2>
          <p className="text-sm text-ink-600">
            قیمت خصوصی فقط با نشست مشتری و تأیید مستقل پشتیبانی از سرور دریافت
            می‌شود.
          </p>
          <button
            onClick={() => setRoute("account")}
            className="bg-buy text-buy-fg rounded-xl px-4 py-2"
          >
            ورود به حساب مشتری
          </button>
        </section>
      )}
      {state?.user?.isDemo && (
        <p className="text-sm text-warning">
          حساب شما آزمایشی است؛ ورود آزمایشی تأیید شمارهٔ واقعی نیست و کالاهای
          نمونه قابل خرید نیستند.
        </p>
      )}
      {state?.application && (
        <section
          className="bg-surface rounded-2xl border border-border p-5 space-y-3"
          aria-label="وضعیت پرونده همکاری"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-500" />
            <h2 className="font-extrabold">{statusLabel(state.application)}</h2>
          </div>
          <p>
            {state.application.businessName} · {state.application.city}
          </p>
          {state.application.reason && (
            <p className="text-sm text-ink-600">
              نتیجهٔ بررسی: {state.application.reason}
            </p>
          )}
          {state.application.expiresAt && (
            <p className="text-xs">
              پایان اعتبار:{" "}
              <bdi>
                {new Date(state.application.expiresAt).toLocaleString("fa-IR")}
              </bdi>
            </p>
          )}
          <p className="text-xs text-ink-500">
            تأیید/تمدید فقط در پنل امن توسط مسئول دارای مجوز انجام می‌شود؛ دکمهٔ
            خودتأییدی وجود ندارد.
          </p>
        </section>
      )}
      {state?.user?.kind === "CUSTOMER" && !state.application && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <section className="lg:col-span-7 bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-500" />
              <h2 className="font-extrabold">
                ثبت درخواست حساب همکار (خرید عمده جینی)
              </h2>
            </div>
            <p className="text-xs text-ink-600">
              هویت و تأیید شماره از نشست سرور بررسی می‌شوند؛ این فرم شماره‌ای را
              تأیید نمی‌کند. توضیحات شما برای بررسی پشتیبانی ذخیره می‌شود.
            </p>
            <form onSubmit={apply} className="space-y-3 text-xs">
              <label className="block font-bold">
                نام فروشگاه / گالری / پیج
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="block w-full mt-1 h-10 px-3 rounded-xl bg-canvas-sunken border border-border"
                />
              </label>
              <label className="block font-bold">
                شهر محل فعالیت
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="block w-full mt-1 h-10 px-3 rounded-xl bg-canvas-sunken border border-border"
                />
              </label>
              <label className="block font-bold">
                توضیحات همکاری و نشانی فروشگاه یا پیج
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="block w-full mt-1 p-3 rounded-xl bg-canvas-sunken border border-border"
                />
              </label>
              <button
                disabled={pending}
                className="w-full py-3 rounded-xl bg-buy text-buy-fg font-extrabold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {pending
                  ? "در حال ارسال…"
                  : "ارسال درخواست به واحد امور همکاران"}
              </button>
            </form>
          </section>
          <aside className="lg:col-span-5 bg-surface rounded-2xl border border-border p-5 space-y-3">
            <Lock className="w-5 h-5 text-brand-500" />
            <h3 className="font-extrabold">محرمانگی نرخ همکار</h3>
            <p className="text-sm text-ink-600">
              هیچ نرخ یا ترکیب جین فرضی نمایش داده نمی‌شود. بسته و قیمت اختصاصی
              پس از تأیید از سرور خوانده می‌شوند. حداقل سفارش یک جین و بدون
              حداقل مبلغ اضافه است.
            </p>
          </aside>
        </div>
      )}
      {catalog && (
        <section aria-label="قیمت اختصاصی همکار" className="space-y-4">
          <p className="text-xs text-ink-600">
            نرخ‌ها مخصوص همین حساب‌اند. موجودی و اعتبار قیمت در زمان محاسبه و
            ثبت رزرو دوباره بررسی می‌شوند. پرداخت فعال نیست.
          </p>
          {catalog.items.length === 0 && (
            <p role="status">
              پیشنهاد معتبر و منتشرشده‌ای برای حساب شما وجود ندارد؛ از مسئول
              همکاری بخواهید قیمت اختصاص دهد.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalog.items.map((offer) => (
              <article
                key={offer.offerId}
                className="bg-surface rounded-2xl border border-border p-4 shadow-e1 space-y-3"
              >
                <div className="flex gap-3">
                  <img
                    src={offer.product.image}
                    alt={offer.product.name}
                    className="w-20 h-20 rounded-xl object-cover shrink-0"
                  />
                  <div>
                    <h3 className="font-extrabold text-sm">
                      {offer.product.name}
                    </h3>
                    <p className="text-xs font-bold text-brand-600 mt-1">
                      {offer.pack.label} (
                      {formatNumber(offer.pack.unitsPerPack)} واحدی)
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {offer.pack.components.map((c, i) => (
                    <span
                      key={i}
                      className="text-[11px] bg-canvas-sunken px-2 py-0.5 rounded-md border border-border"
                    >
                      {formatNumber(c.units)}× {c.name}
                    </span>
                  ))}
                </div>
                {offer.pricing === "PRICED" ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center bg-canvas-sunken p-2.5 rounded-xl">
                      <div>
                        <span className="text-[10px] block">واحد عمده</span>
                        <span className="text-xs font-extrabold text-brand-600">
                          {formatToman(offer.unitPriceToman)}
                        </span>
                      </div>
                      <div className="border-x border-border">
                        <span className="text-[10px] block">قیمت ۱ جین</span>
                        <span className="text-xs font-black">
                          {formatToman(offer.packPriceToman)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] block">تکی سایت</span>
                        <span className="text-xs">
                          {formatToman(offer.product.retailPriceToman)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-1.5 bg-canvas-sunken rounded-xl p-1 border border-border">
                        <button
                          aria-label={"کاهش جین " + offer.pack.label}
                          disabled={
                            pending || (counts[offer.offerId] || 1) <= 1
                          }
                          onClick={() => quantity(offer.offerId, -1)}
                          className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center disabled:opacity-40"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-extrabold">
                          {formatNumber(counts[offer.offerId] || 1)} جین
                        </span>
                        <button
                          aria-label={"افزایش جین " + offer.pack.label}
                          disabled={
                            pending || (counts[offer.offerId] || 1) >= 1000
                          }
                          onClick={() => quantity(offer.offerId, 1)}
                          className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        disabled={
                          pending || !offer.available || offer.product.isDemo
                        }
                        onClick={() => void add(offer)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-buy text-buy-fg text-xs font-extrabold disabled:opacity-50"
                      >
                        {offer.product.isDemo
                          ? "کالای نمونه؛ غیرقابل خرید"
                          : offer.available
                            ? "افزودن جین به سبد عمده"
                            : "موجودی کمتر از ۱ جین"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="p-3 bg-canvas-sunken rounded-xl text-sm">
                    نرخ استعلامی است؛ قیمت قابل سفارش منتشر نشده. برای قیمت با
                    مسئول همکاری تماس بگیرید.
                  </p>
                )}
                {offer.validUntil && (
                  <p className="text-[11px] text-ink-500">
                    اعتبار نرخ تا{" "}
                    {new Date(offer.validUntil).toLocaleString("fa-IR")}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
