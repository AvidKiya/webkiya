"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { PackManager } from "./pack-manager";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import { categories, faNumber } from "@/lib/catalog";
type Variant = {
  id: string;
  name: string;
  hex: string;
  sku: string;
  version: number;
  isActive: boolean;
};
type Detail = {
  id: string;
  name: string;
  price: string;
  version: number;
  status: string;
  subtitle: string;
  category: string;
  description: string;
  imagePath: string;
  packSize: number | null;
  tag: string;
  collection: string;
  isDemo: boolean;
  variants: Variant[];
};
type Stock = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  reserved: number;
  version: number;
  isActive: boolean;
};
type Inventory = {
  variants: Stock[];
  movements: {
    id: string;
    variantId: string;
    delta: number;
    stockAfter: number;
    reason: string;
    createdAt: string;
  }[];
};
export function ProductWorkbench({
  id,
  permissions,
  onSaved,
}: {
  id: string;
  permissions: string[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [detail, setDetail] = useState<Detail | null>(null),
    [inventory, setInventory] = useState<Inventory | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [image, setImage] = useState(""),
    [message, setMessage] = useState("");
  const canWrite = permissions.includes("product:write"),
    canPublish = permissions.includes("product:publish"),
    canStock = permissions.includes("inventory:read"),
    manageStock = permissions.includes("inventory:manage");
  const load = useCallback(async () => {
    const d = await api<Detail>("/api/admin/products/" + id);
    setDetail(d);
    setImage(d.imagePath);
    if (canStock)
      setInventory(
        await api<Inventory>("/api/admin/products/" + id + "/inventory"),
      );
    setError("");
  }, [id, canStock]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    api<Detail>("/api/admin/products/" + id)
      .then((d) => {
        if (active) {
          setDetail(d);
          setImage(d.imagePath);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    if (canStock)
      api<Inventory>("/api/admin/products/" + id + "/inventory")
        .then((d) => {
          if (active) setInventory(d);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [id, open, canStock]);
  async function change(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await load();
      onSaved();
      setMessage("تغییرات روی سرور ثبت شد.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("حداکثر حجم تصویر ۵ مگابایت است.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/media", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.error?.message || "بارگذاری ناموفق بود.");
      setImage(result.data.url);
      setMessage("تصویر آماده شد؛ برای اتصال به کالا، مشخصات را ذخیره کنید.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="product-workbench"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>مشخصات، رنگ‌ها، موجودی و انتشار</summary>
      {open ? (
        <div>
          {error ? (
            <p className="admin-alert" role="alert">
              {error}
            </p>
          ) : null}
          {message ? <p role="status">{message}</p> : null}
          <button
            className="text-link"
            onClick={() => load().catch((e) => setError(e.message))}
          >
            تازه‌سازی پروندهٔ کالا
          </button>
          {!detail ? (
            <p role="status">در حال دریافت کالا…</p>
          ) : (
            <>
              {detail.status === "PUBLISHED" ? (
                <Link
                  className="text-link"
                  href={"/p/" + id}
                  target="_blank"
                  rel="noreferrer"
                >
                  مشاهدهٔ کالا در ویترین
                </Link>
              ) : null}
              <p className="admin-note">
                {detail.isDemo
                  ? "این کالا دادهٔ نمونه است."
                  : "کالای ثبت‌شده توسط مدیریت."}{" "}
                انتشار فقط ویترین را فعال می‌کند؛ سفارش و پرداخت هنوز خاموش‌اند.
                تعداد واحد بسته فقط مشخصه است، نه BOM یا سفارش عمده.
              </p>
              <form
                key={detail.version}
                className="backend-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await change(
                    "/api/admin/products/" + id + "/details",
                    "PUT",
                    {
                      name: f.get("name"),
                      price: f.get("price"),
                      subtitle: f.get("subtitle"),
                      category: f.get("category"),
                      description: f.get("description"),
                      imagePath: image,
                      packSize: f.get("packSize")
                        ? Number(f.get("packSize"))
                        : null,
                      tag: f.get("tag"),
                      collection: f.get("collection"),
                      version: detail.version,
                    },
                  );
                }}
              >
                <fieldset
                  disabled={!canWrite || detail.status !== "DRAFT" || busy}
                >
                  <legend>مشخصات عمومی</legend>
                  <label>
                    نام اصلی کالا
                    <input
                      name="name"
                      minLength={2}
                      maxLength={160}
                      required
                      defaultValue={detail.name}
                    />
                  </label>
                  <label>
                    عنوان کوتاه برای پست
                    <input
                      name="subtitle"
                      maxLength={160}
                      defaultValue={detail.subtitle}
                    />
                  </label>
                  <label>
                    دستهٔ کالا
                    <select name="category" defaultValue={detail.category}>
                      <option value="">انتخاب دسته</option>
                      {categories.slice(1).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    توضیحات کالا
                    <textarea
                      name="description"
                      maxLength={3000}
                      rows={4}
                      defaultValue={detail.description}
                    />
                  </label>
                  <label>
                    قیمت خرده (تومان، عدد صحیح)
                    <input
                      name="price"
                      dir="ltr"
                      inputMode="numeric"
                      pattern="(0|[1-9][0-9]{0,13})"
                      required
                      defaultValue={detail.price}
                    />
                  </label>
                  <label>
                    تعداد واحد داخل بسته
                    <input
                      name="packSize"
                      type="number"
                      min={1}
                      max={10000}
                      defaultValue={detail.packSize || ""}
                    />
                  </label>
                  <label>
                    برچسب روی پست
                    <input
                      name="tag"
                      maxLength={40}
                      defaultValue={detail.tag}
                    />
                  </label>
                  <label>
                    نام مجموعه
                    <input
                      name="collection"
                      maxLength={80}
                      defaultValue={detail.collection}
                    />
                  </label>
                  <label>
                    تصویر اصلی کالا
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void upload(e.target.files?.[0])}
                    />
                  </label>
                  <small>
                    JPG/PNG/WebP ثابت، حداکثر۵MB و حداقل۲۰۰پیکسل. تصویر هنگام
                    انتشار عمومی می‌شود؛ اطلاعات شخصی در عکس نباشد.
                  </small>
                </fieldset>
                {image ? (
                  <Image
                    unoptimized
                    src={image}
                    alt="تصویر پروندهٔ کالا"
                    width={180}
                    height={180}
                    className="product-editor-image"
                  />
                ) : null}
                {canWrite && detail.status === "DRAFT" ? (
                  <button className="primary" disabled={busy}>
                    ذخیره مشخصات کالا
                  </button>
                ) : null}
              </form>
              <section className="workbench-section">
                <h4>رنگ‌ها و SKU</h4>
                {detail.variants.map((v) => (
                  <div className="variant-record" key={v.id}>
                    <p>
                      <span
                        className="variant-swatch"
                        style={{ backgroundColor: v.hex }}
                      />
                      {v.name} · <code dir="ltr">{v.sku}</code> ·{" "}
                      {v.isActive ? "فعال" : "غیرفعال"}
                    </p>
                    {canWrite && detail.status === "DRAFT" ? (
                      <form
                        key={v.version}
                        className="variant-edit"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void change(
                            "/api/admin/products/" + id + "/variants/" + v.id,
                            "PATCH",
                            {
                              name: f.get("name"),
                              hex: f.get("hex"),
                              isActive: f.get("isActive") === "on",
                              version: v.version,
                            },
                          );
                        }}
                      >
                        <label>
                          نام رنگ
                          <input
                            name="name"
                            defaultValue={v.name}
                            required
                            maxLength={60}
                          />
                        </label>
                        <label>
                          کد رنگ
                          <input name="hex" type="color" defaultValue={v.hex} />
                        </label>
                        <label className="access-check">
                          <input
                            type="checkbox"
                            name="isActive"
                            defaultChecked={v.isActive}
                          />
                          رنگ فعال
                        </label>
                        <button className="secondary" disabled={busy}>
                          ذخیره رنگ
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
                {canWrite && detail.status === "DRAFT" ? (
                  <form
                    className="backend-form variant-create"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget,
                        f = new FormData(form);
                      if (
                        await change(
                          "/api/admin/products/" + id + "/variants",
                          "POST",
                          {
                            name: f.get("name"),
                            hex: f.get("hex"),
                            sku: f.get("sku"),
                          },
                        )
                      )
                        form.reset();
                    }}
                  >
                    <h4>افزودن رنگ جدید</h4>
                    <label>
                      نام رنگ جدید
                      <input name="name" required maxLength={60} />
                    </label>
                    <label>
                      کد SKU جدید
                      <input
                        name="sku"
                        dir="ltr"
                        required
                        maxLength={60}
                        pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,59}"
                      />
                    </label>
                    <label>
                      رنگ جدید
                      <input type="color" name="hex" defaultValue="#482780" />
                    </label>
                    <button className="primary" disabled={busy}>
                      افزودن رنگ با موجودی صفر
                    </button>
                  </form>
                ) : null}
              </section>
              <PackManager
                productId={id}
                productStatus={detail.status}
                productVersion={detail.version}
                variants={detail.variants}
                permissions={permissions}
              />
              {canStock ? (
                <section className="workbench-section">
                  <h4>موجودی واقعی (واحد تکی)</h4>
                  <p className="micro">
                    موجودی اولیه صفر است. هر اصلاح با دلیل و شناسهٔ تکرارناپذیر
                    ثبت می‌شود؛ این ابزار رزرو یا فروش ایجاد نمی‌کند.
                  </p>
                  {inventory?.variants.map((v) => (
                    <article className="stock-record" key={v.id}>
                      <h5>
                        {v.name} · <code dir="ltr">{v.sku}</code>
                      </h5>
                      <p>
                        کل: {faNumber(v.stock)} · رزرو: {faNumber(v.reserved)} ·
                        قابل تخصیص: {faNumber(v.stock - v.reserved)}
                      </p>
                      {manageStock ? (
                        <StockForm
                          variant={v}
                          onSaved={async () => {
                            await load();
                            onSaved();
                          }}
                        />
                      ) : null}
                    </article>
                  ))}
                  {inventory?.movements.length ? (
                    <details>
                      <summary>آخرین ۳۰ تغییر موجودی</summary>
                      {inventory.movements.map((m) => (
                        <p className="stock-history" key={m.id}>
                          {
                            inventory.variants.find((v) => v.id === m.variantId)
                              ?.name
                          }{" "}
                          · {m.delta > 0 ? "+" : ""}
                          {faNumber(m.delta)} · مانده {faNumber(m.stockAfter)} ·{" "}
                          {m.reason} ·{" "}
                          {new Date(m.createdAt).toLocaleString("fa-IR")}
                        </p>
                      ))}
                    </details>
                  ) : null}
                </section>
              ) : null}
              {canPublish ? (
                <form
                  className="backend-form workbench-section"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void change(
                      "/api/admin/products/" + id + "/status",
                      "PATCH",
                      {
                        status:
                          detail.status === "DRAFT"
                            ? "PUBLISHED"
                            : detail.status === "PUBLISHED"
                              ? "ARCHIVED"
                              : "DRAFT",
                        version: detail.version,
                        reason: f.get("reason"),
                      },
                    );
                  }}
                >
                  <h4>وضعیت انتشار</h4>
                  <p className="micro">
                    برای ویرایش کالای منتشرشده ابتدا بایگانی، سپس به پیش‌نویس
                    برگردانید. قیمت و موجودی تأییدنشده، اجازهٔ دریافت وجه ایجاد
                    نمی‌کنند.
                  </p>
                  <label>
                    دلیل تغییر وضعیت
                    <input
                      name="reason"
                      minLength={3}
                      maxLength={500}
                      required
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    {detail.status === "DRAFT"
                      ? "انتشار در ویترین"
                      : detail.status === "PUBLISHED"
                        ? "بایگانی کالا"
                        : "بازگردانی به پیش‌نویس"}
                  </button>
                </form>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </details>
  );
}
function StockForm({
  variant,
  onSaved,
}: {
  variant: Stock;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const retry = useRef<{ body: string; id: string } | null>(null);
  return (
    <form
      className="backend-form stock-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          f = new FormData(form);
        const payload = {
            delta: Number(f.get("delta")),
            reason: String(f.get("reason")),
            version: variant.version,
          },
          body = JSON.stringify(payload);
        if (retry.current?.body !== body)
          retry.current = { body, id: crypto.randomUUID() };
        setBusy(true);
        setError("");
        try {
          await api("/api/admin/inventory/" + variant.id, {
            method: "POST",
            body: JSON.stringify({ ...payload, requestId: retry.current.id }),
          });
          retry.current = null;
          form.reset();
          await onSaved();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        تغییر تعداد (+ ورود / − خروج)
        <input
          name="delta"
          type="number"
          min={-1000000}
          max={1000000}
          step={1}
          required
        />
      </label>
      <label>
        دلیل اصلاح موجودی
        <input name="reason" required minLength={3} maxLength={500} />
      </label>
      <button className="secondary" disabled={busy}>
        ثبت اصلاح موجودی
      </button>
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
