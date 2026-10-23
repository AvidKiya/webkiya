"use client";
import { useState } from "react";
import { api } from "@/lib/api";
export function DraftProductForm({
  product,
  onSaved,
}: {
  product?: { id: string; name: string; price: string; version: number };
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      fields = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(
        product ? "/api/admin/products/" + product.id : "/api/admin/products",
        {
          method: product ? "PATCH" : "POST",
          body: JSON.stringify({
            name: fields.get("name"),
            price: fields.get("price"),
            ...(product ? { version: product.version } : {}),
          }),
        },
      );
      if (!product) form.reset();
      setSuccess(
        product
          ? "تغییرات در پایگاه داده ذخیره شد."
          : "پیش‌نویس در پایگاه داده ساخته شد؛ منتشر نشده است.",
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="backend-form admin-product-form" onSubmit={submit}>
      <label>
        نام کالا
        <input
          name="name"
          required
          minLength={2}
          maxLength={160}
          defaultValue={product?.name || ""}
        />
      </label>
      <label>
        قیمت پایهٔ پیش‌نویس (تومان، فقط رقم انگلیسی)
        <input
          name="price"
          required
          inputMode="numeric"
          pattern="(0|[1-9][0-9]{0,13})"
          maxLength={14}
          dir="ltr"
          defaultValue={product?.price || ""}
        />
      </label>
      <button className="primary" disabled={busy}>
        {busy
          ? "در حال ذخیره…"
          : product
            ? "ذخیره تغییرات پیش‌نویس"
            : "ثبت پیش‌نویس"}
      </button>
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      {success ? <p role="status">{success}</p> : null}
    </form>
  );
}
