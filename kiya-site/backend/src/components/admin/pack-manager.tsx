"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { faNumber } from "@/lib/catalog";
type Variant = { id: string; name: string; isActive: boolean };
type Pack = {
  id: string;
  label: string;
  mode: string;
  status: string;
  version: number;
  unitsPerPack: number;
  components: {
    variantId: string;
    units: number;
    variant: { name: string; hex: string; isActive: boolean };
  }[];
};
export function PackManager({
  productId,
  productStatus,
  productVersion,
  variants,
  permissions,
}: {
  productId: string;
  productStatus: string;
  productVersion: number;
  variants: Variant[];
  permissions: string[];
}) {
  const [packs, setPacks] = useState<Pack[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const manage = permissions.includes("wholesale:pack:manage"),
    publish = permissions.includes("wholesale:pack:publish");
  const load = useCallback(async () => {
    const data = await api<{ items: Pack[] }>(
      "/api/admin/products/" + productId + "/packs",
    );
    setPacks(data.items);
  }, [productId]);
  useEffect(() => {
    let active = true;
    api<{ items: Pack[] }>("/api/admin/products/" + productId + "/packs")
      .then((d) => {
        if (active) setPacks(d.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId, productVersion]);
  async function save(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await load();
      setNotice("تعریف جین روی سرور ثبت شد.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workbench-section pack-manager">
      <h4>تعریف واقعی جین و ترکیب رنگ‌ها (BOM)</h4>
      <p className="admin-note">
        یک جین برای حداقل عمده کافی است؛ تعداد داخل آن از ترکیب زیر محاسبه
        می‌شود، نه عدد ثابت۱۲. این ابزار فقط تعریف جین است؛ قیمت خصوصی بخش
        جداگانه دارد. رزرو، ثبت سفارش یا پرداخت هنوز فعال نیست. «فعال» به معنی
        آماده‌بودن تعریف است، نه قابل خرید بودن.
      </p>
      {loading ? <p role="status">در حال دریافت تعریف‌های جین…</p> : null}
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
        تازه‌سازی تعریف‌های جین
      </button>
      {!loading && !packs.length ? (
        <p className="micro">
          هنوز جین واقعی برای این کالا ثبت نشده است؛ تعداد واحد بسته در مشخصات
          جایگزین ترکیب جین نیست.
        </p>
      ) : null}
      {packs.map((p) => (
        <article className="pack-record" key={p.id}>
          <h5>
            {p.label} ·{" "}
            {p.status === "ACTIVE"
              ? "فعال"
              : p.status === "DRAFT"
                ? "پیش‌نویس"
                : "بایگانی"}
          </h5>
          <p>
            {faNumber(p.unitsPerPack)} واحد در هر جین ·{" "}
            {p.mode === "HOMOGENEOUS" ? "هم‌رنگ / یک SKU" : "ترکیب ثابت رنگ‌ها"}{" "}
            · نسخه{faNumber(p.version)}
          </p>
          <ul>
            {p.components.map((c) => (
              <li key={c.variantId}>
                {c.variant.name}: {faNumber(c.units)} واحد
                {!c.variant.isActive ? " · رنگ غیرفعال" : ""}
              </li>
            ))}
          </ul>
          {manage && p.status === "DRAFT" && productStatus === "DRAFT" ? (
            <details>
              <summary>ویرایش ترکیب پیش‌نویس</summary>
              <PackForm
                key={p.version}
                variants={variants}
                initial={p}
                busy={busy}
                submit={(body) =>
                  save(
                    "/api/admin/products/" + productId + "/packs/" + p.id,
                    "PUT",
                    { ...body, version: p.version },
                  )
                }
              />
            </details>
          ) : null}
          {publish && p.status !== "ARCHIVED" ? (
            <form
              className="backend-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                if (
                  await save(
                    "/api/admin/products/" +
                      productId +
                      "/packs/" +
                      p.id +
                      "/status",
                    "PATCH",
                    {
                      version: p.version,
                      status: f.get("status"),
                      reason: f.get("reason"),
                    },
                  )
                )
                  form.reset();
              }}
            >
              <label>
                عملیات جین
                <select
                  name="status"
                  defaultValue={
                    p.status === "DRAFT" && productStatus === "PUBLISHED"
                      ? "ACTIVE"
                      : "ARCHIVED"
                  }
                >
                  {p.status === "DRAFT" && productStatus === "PUBLISHED" ? (
                    <option value="ACTIVE">فعال‌کردن تعریف جین</option>
                  ) : null}
                  <option value="ARCHIVED">بایگانی این تعریف</option>
                </select>
              </label>
              <label>
                دلیل تغییر وضعیت جین
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
              <button className="secondary" disabled={busy}>
                ثبت وضعیت جین
              </button>
              {p.status === "DRAFT" && productStatus !== "PUBLISHED" ? (
                <small>برای فعال‌کردن جین ابتدا خود کالا را منتشر کنید.</small>
              ) : null}
            </form>
          ) : null}
        </article>
      ))}
      {manage && productStatus === "DRAFT" ? (
        <details className="pack-create">
          <summary>ساخت تعریف جین جدید</summary>
          {variants.some((v) => v.isActive) ? (
            <PackForm
              variants={variants}
              busy={busy}
              submit={(body) =>
                save(
                  "/api/admin/products/" + productId + "/packs",
                  "POST",
                  body,
                )
              }
            />
          ) : (
            <p>ابتدا حداقل یک رنگ فعال برای کالا بسازید.</p>
          )}
        </details>
      ) : null}
      <p className="micro">
        ترکیب فعال قابل ویرایش نیست؛ آن را بایگانی و جایگزین بسازید. برای تغییر
        رنگی که در جین فعال است نیز اول جین را بایگانی کنید. فهرست حداکثر۵۰تعریف
        اخیر را نمایش می‌دهد.
      </p>
    </section>
  );
}
type Body = {
  label: string;
  mode: string;
  components: { variantId: string; units: number }[];
};
function PackForm({
  variants,
  initial,
  busy,
  submit,
}: {
  variants: Variant[];
  initial?: Pack;
  busy: boolean;
  submit: (body: Body) => Promise<boolean>;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
      Object.fromEntries(
        initial?.components.map((c) => [c.variantId, c.units]) || [],
      ),
    ),
    [mode, setMode] = useState(initial?.mode || "FIXED_ASSORTMENT"),
    [invalid, setInvalid] = useState("");
  const total = Object.values(quantities).reduce((s, n) => s + n, 0);
  return (
    <form
      className="backend-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          components = Object.entries(quantities)
            .filter(([, units]) => units > 0)
            .map(([variantId, units]) => ({ variantId, units }));
        if (
          total < 1 ||
          total > 10000 ||
          components.length > 30 ||
          (mode === "HOMOGENEOUS" && components.length !== 1)
        ) {
          setInvalid("مجموع باید۱تا۱۰۰۰۰ باشد؛ جین هم‌رنگ فقط یک رنگ دارد.");
          return;
        }
        setInvalid("");
        await submit({ label: String(f.get("label")), mode, components });
      }}
    >
      <label>
        نام تعریف جین
        <input
          name="label"
          required
          minLength={2}
          maxLength={80}
          defaultValue={initial?.label || ""}
          placeholder="نام بستهٔ واقعی خودتان"
        />
      </label>
      <label>
        نوع ترکیب
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="FIXED_ASSORTMENT">ترکیب ثابت چند رنگ</option>
          <option value="HOMOGENEOUS">هم‌رنگ، فقط یک SKU</option>
        </select>
      </label>
      <fieldset disabled={busy}>
        <legend>تعداد هر رنگ در یک جین (صفر = خارج ترکیب)</legend>
        {variants.map((v) => (
          <label key={v.id}>
            {v.name}
            {!v.isActive ? " · غیرفعال؛ برای حذف از ترکیب صفر کنید" : ""}
            <input
              aria-label={"تعداد در جین: " + v.name}
              type="number"
              min={0}
              max={v.isActive ? 10000 : 0}
              step={1}
              value={quantities[v.id] || 0}
              onChange={(e) =>
                setQuantities((q) => ({ ...q, [v.id]: Number(e.target.value) }))
              }
            />
          </label>
        ))}
      </fieldset>
      <p aria-live="polite">
        مجموع: {faNumber(total)} واحد در یک جین · حداقل عمده: ۱ جین
      </p>
      {invalid ? <p role="alert">{invalid}</p> : null}
      <button className="primary" disabled={busy}>
        ذخیره تعریف جین
      </button>
    </form>
  );
}
