"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { faNumber, money } from "@/lib/catalog";
type Offer = {
  id: string;
  packId: string;
  partnerId: string;
  mode: string;
  unitPriceToman: string | null;
  validFrom: string;
  validUntil: string | null;
  status: string;
  version: number;
  createdBy: string;
  reason: string;
  partner: { businessName: string };
  pack: { label: string; unitsPerPack: number };
};
type Context = {
  actorId: string;
  packs: { id: string; label: string; unitsPerPack: number }[];
  partners: { id: string; businessName: string; user: { isDemo: boolean } }[];
  items: Offer[];
};
export function WholesalePrices({
  productId,
  permissions,
}: {
  productId: string;
  permissions: string[];
}) {
  const [data, setData] = useState<Context | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState("PRICED");
  const retry = useRef<{ body: string; id: string } | null>(null);
  const manage = permissions.includes("wholesale:price:manage"),
    publish = permissions.includes("wholesale:price:publish");
  const load = useCallback(
    async () =>
      setData(
        await api<Context>("/api/admin/products/" + productId + "/offers"),
      ),
    [productId],
  );
  useEffect(() => {
    let active = true;
    api<Context>("/api/admin/products/" + productId + "/offers")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [productId]);
  async function review(offer: Offer, status: string, reason: string) {
    setBusy(true);
    setError("");
    try {
      await api(
        "/api/admin/products/" + productId + "/offers/" + offer.id + "/status",
        {
          method: "PATCH",
          body: JSON.stringify({ status, reason, version: offer.version }),
        },
      );
      await load();
      setNotice("وضعیت قیمت در سرور ثبت شد.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workbench-section wholesale-price-manager">
      <h4>قیمت خصوصی عمده برای همکار مشخص</h4>
      <p className="admin-note">
        قیمت هر واحد را به تومان ثبت کنید؛ قیمت جین از جمع واحدهای همان BOM
        محاسبه می‌شود. ثبت‌کننده نمی‌تواند قیمت خودش را منتشر کند؛ پرسنل مجاز
        دیگری باید بررسی کند. قیمت واحد تمام اجزای جین در این نسخه یکسان است.
        قیمت واقعی را حدس نزنید. سفارش و پرداخت هنوز فعال نیستند.
      </p>
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <button
        className="text-link"
        type="button"
        disabled={busy}
        onClick={() =>
          load()
            .then(() => setError(""))
            .catch((e) => setError(e.message))
        }
      >
        تازه‌سازی قیمت‌ها و همکارها
      </button>
      {!data ? (
        <p>در حال دریافت پرونده‌های قیمت…</p>
      ) : (
        <>
          {manage ? (
            <form
              className="backend-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                const start = String(f.get("validFrom")),
                  end = String(f.get("validUntil"));
                if (
                  !Number.isFinite(Date.parse(start)) ||
                  (end && !Number.isFinite(Date.parse(end)))
                ) {
                  setError("زمان معتبر وارد کنید.");
                  return;
                }
                const payload = {
                  packId: String(f.get("packId")),
                  partnerId: String(f.get("partnerId")),
                  mode,
                  unitPriceToman:
                    mode === "PRICED" ? String(f.get("unitPriceToman")) : null,
                  validFrom: new Date(start).toISOString(),
                  validUntil: end ? new Date(end).toISOString() : null,
                  reason: String(f.get("reason")),
                };
                const body = JSON.stringify(payload);
                if (retry.current?.body !== body)
                  retry.current = { body, id: crypto.randomUUID() };
                setBusy(true);
                setError("");
                setNotice("");
                try {
                  await api("/api/admin/products/" + productId + "/offers", {
                    method: "POST",
                    body: JSON.stringify({
                      ...payload,
                      requestId: retry.current.id,
                    }),
                  });
                  retry.current = null;
                  await load();
                  setNotice(
                    "پیش‌نویس قیمت ثبت شد؛ برای انتشار، تأیید پرسنل دیگری لازم است.",
                  );
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                جین فعال
                <select name="packId" required defaultValue="">
                  <option value="" disabled>
                    انتخاب جین
                  </option>
                  {data.packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} · {faNumber(p.unitsPerPack)} واحد
                    </option>
                  ))}
                </select>
              </label>
              <label>
                همکار دریافت‌کنندهٔ قیمت
                <select name="partnerId" required defaultValue="">
                  <option value="" disabled>
                    انتخاب همکار تأییدشده
                  </option>
                  {data.partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.businessName}
                      {p.user.isDemo ? " · آزمایشی" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                حالت قیمت
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="PRICED">قیمت مشخص برای هر واحد</option>
                  <option value="INQUIRY">فقط استعلام، بدون عدد قیمت</option>
                </select>
              </label>
              {mode === "PRICED" ? (
                <label>
                  قیمت عمدهٔ هر واحد (تومان)
                  <input
                    name="unitPriceToman"
                    required
                    inputMode="numeric"
                    dir="ltr"
                    pattern="[1-9][0-9]{0,13}"
                    maxLength={14}
                  />
                </label>
              ) : null}
              <label>
                شروع اعتبار (زمان محلی دستگاه)
                <input type="datetime-local" name="validFrom" required />
              </label>
              <label>
                پایان اعتبار (اختیاری)
                <input type="datetime-local" name="validUntil" />
              </label>
              <label>
                دلیل ثبت قیمت
                <input name="reason" minLength={3} maxLength={500} required />
              </label>
              <button
                className="primary"
                disabled={busy || !data.packs.length || !data.partners.length}
              >
                ثبت پیش‌نویس قیمت خصوصی
              </button>
              <small>
                قیمت منتشرشده و پیش‌نویس قابل ویرایش نیستند؛ بایگانی و جایگزین
                بسازید. برای هر همکار/جین فقط یک قیمت منتشرشده مجاز است، حتی اگر
                منقضی باشد. اطلاعات انتخاب تا۱۰۰همکار و۵۰جین محدود است.
              </small>
            </form>
          ) : null}
          {!data.items.length ? (
            <p className="micro">هنوز قیمت خصوصی برای این کالا ثبت نشده است.</p>
          ) : null}
          {data.items.map((o) => (
            <article className="pack-record" key={o.id}>
              <h5>
                {o.partner.businessName} · {o.pack.label}
              </h5>
              <p>
                {o.status === "PUBLISHED"
                  ? "منتشرشده"
                  : o.status === "ARCHIVED"
                    ? "بایگانی"
                    : "پیش‌نویس"}{" "}
                · نسخه{faNumber(o.version)}
              </p>
              <p>
                {o.mode === "INQUIRY" ? (
                  "فقط استعلام"
                ) : (
                  <>
                    هر واحد {money(o.unitPriceToman!)} تومان · هر جین{" "}
                    {money(
                      (
                        BigInt(o.unitPriceToman!) * BigInt(o.pack.unitsPerPack)
                      ).toString(),
                    )}{" "}
                    تومان
                  </>
                )}
              </p>
              <p>
                {new Date(o.validFrom).toLocaleString("fa-IR")} تا{" "}
                {o.validUntil
                  ? new Date(o.validUntil).toLocaleString("fa-IR")
                  : "بدون تاریخ پایان"}{" "}
                · {o.reason}
              </p>
              {publish && o.status !== "ARCHIVED" ? (
                <form
                  className="backend-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void review(
                      o,
                      String(f.get("status")),
                      String(f.get("reason")),
                    );
                  }}
                >
                  <label>
                    عملیات قیمت
                    <select
                      name="status"
                      defaultValue={
                        o.status === "DRAFT" && o.createdBy !== data.actorId
                          ? "PUBLISHED"
                          : "ARCHIVED"
                      }
                    >
                      {o.status === "DRAFT" && o.createdBy !== data.actorId ? (
                        <option value="PUBLISHED">
                          تأیید مستقل و انتشار قیمت
                        </option>
                      ) : null}
                      <option value="ARCHIVED">بایگانی قیمت</option>
                    </select>
                  </label>
                  <label>
                    دلیل تصمیم قیمت
                    <input
                      name="reason"
                      minLength={3}
                      maxLength={500}
                      required
                    />
                  </label>
                  <button className="secondary" disabled={busy}>
                    ثبت تصمیم قیمت
                  </button>
                  {o.createdBy === data.actorId && o.status === "DRAFT" ? (
                    <small>
                      شما ثبت‌کننده هستید؛ انتشار توسط خودتان ممنوع است.
                    </small>
                  ) : null}
                </form>
              ) : null}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
export function PartnerValidity({
  id,
  version,
  expiresAt,
  onSaved,
}: {
  id: string;
  version: number;
  expiresAt: string | null;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <details className="product-workbench">
      <summary>تنظیم اعتبار همکاری</summary>
      <p className="micro">
        اعتبار فعلی:{" "}
        {expiresAt
          ? new Date(expiresAt).toLocaleString("fa-IR")
          : "بدون تاریخ انقضا"}
        . تاریخ گذشته دسترسی قیمت را می‌بندد؛ وضعیت پرونده همچنان تأییدشده
        می‌ماند.
      </p>
      <form
        className="backend-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            value = String(f.get("expiresAt"));
          setBusy(true);
          setError("");
          try {
            await api("/api/admin/partners/" + id + "/validity", {
              method: "PUT",
              body: JSON.stringify({
                expiresAt: value ? new Date(value).toISOString() : null,
                version,
                reason: f.get("reason"),
              }),
            });
            onSaved();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          تاریخ پایان جدید؛ خالی یعنی بدون انقضا
          <input type="datetime-local" name="expiresAt" />
        </label>
        <label>
          دلیل تنظیم اعتبار
          <input name="reason" required minLength={3} maxLength={500} />
        </label>
        <button className="secondary" disabled={busy}>
          ثبت اعتبار همکاری
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </details>
  );
}
