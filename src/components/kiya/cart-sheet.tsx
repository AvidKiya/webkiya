"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ShoppingBag,
  Trash2,
  X,
  Info,
  CreditCard,
  Truck,
  ArrowLeft,
  Check,
} from "lucide-react";
import type { CartItem, Product } from "@/lib/catalog";
import { formatNumber, formatPrice } from "./kit";

export function KiyaCartSheet({
  open,
  products,
  cart,
  onClose,
  onQuantity,
  onRemove,
}: {
  open: boolean;
  products: Product[];
  cart: CartItem[];
  onClose: () => void;
  onQuantity: (item: CartItem, delta: number) => void;
  onRemove: (item: CartItem) => void;
}) {
  const [step, setStep] = useState<"cart" | "review">("cart");

  if (!open) return null;

  const lines = cart
    .map((item) => ({
      item,
      product: products.find((product) => product.id === item.productId),
    }))
    .filter((line): line is { item: CartItem; product: Product } =>
      Boolean(line.product),
    );
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line.product.price) * line.item.qty,
    0,
  );

  return (
    <div className="fixed inset-0 z-[115] flex items-end md:items-center justify-center p-0 md:p-4">
      <button
        type="button"
        aria-label="بستن سبد"
        className="absolute inset-0 bg-[#141018]/65 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="سبد خرید"
        className="relative w-full max-w-[520px] max-h-[90vh] bg-surface rounded-t-3xl md:rounded-3xl shadow-e4 sheet-in flex flex-col safe-bottom overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-500" />
            <h2 className="font-extrabold text-base text-ink-900">
              سبد خرید تکی
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-500 hover:bg-canvas-sunken"
            aria-label="بستن سبد خرید"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-2 bg-canvas-sunken border-b border-border flex items-center gap-2 text-[11px] font-bold">
          <span
            className={
              step === "cart" ? "text-brand-500" : "text-ink-400 line-through"
            }
          >
            ۱ · سبد
          </span>
          <span className="text-ink-300">/</span>
          <span
            className={step === "review" ? "text-brand-500" : "text-ink-400"}
          >
            ۲ · بررسی و ارسال
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {lines.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-2">
              <ShoppingBag className="w-12 h-12 text-ink-300 mx-auto" />
              <p className="font-extrabold text-ink-800">سبد خرید خالی است</p>
              <p className="text-xs text-ink-500">
                از فید یا اکسپلور، کالای مورد نظرت را انتخاب کن.
              </p>
            </div>
          ) : (
            lines.map(({ item, product }) => (
              <div key={product.id + item.color} className="p-4 flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-20 h-20 rounded-xl object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-ink-900 line-clamp-1">
                      {product.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onRemove(item)}
                      className="text-ink-400 hover:text-danger"
                      aria-label={`حذف ${product.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    رنگ: {item.color}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onQuantity(item, -1)}
                        className="w-7 h-7 rounded-lg bg-canvas-sunken text-sm font-bold"
                        aria-label="کاهش تعداد"
                      >
                        −
                      </button>
                      <span className="text-xs font-extrabold px-2">
                        {formatNumber(item.qty)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuantity(item, 1)}
                        className="w-7 h-7 rounded-lg bg-canvas-sunken text-sm font-bold"
                        aria-label="افزایش تعداد"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-extrabold text-ink-900">
                      {formatPrice(Number(product.price) * item.qty)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border space-y-3 bg-canvas-sunken/40">
          {step === "review" && lines.length > 0 && (
            <div className="space-y-2 rounded-xl bg-surface border border-border p-3">
              <p className="text-xs font-extrabold text-ink-900">
                بررسی نهایی سفارش
              </p>
              <ul className="space-y-1">
                {lines.map(({ item, product }) => (
                  <li
                    key={product.id + item.color}
                    className="flex items-center justify-between gap-2 text-[11px] text-ink-600"
                  >
                    <span className="truncate">
                      {product.name} · {item.color} × {formatNumber(item.qty)}
                    </span>
                    <span className="font-bold text-ink-800 shrink-0">
                      {formatPrice(Number(product.price) * item.qty)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-1.5 pt-1">
                <p className="flex items-center gap-1.5 text-[11px] text-warning">
                  <CreditCard className="w-3.5 h-3.5" />
                  پرداخت آنلاین هنوز فعال نیست؛ سفارش بدون پرداخت ثبت می‌شود.
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-info">
                  <Truck className="w-3.5 h-3.5" />
                  هزینه و روش ارسال در مرحلهٔ بعد با پشتیبانی هماهنگ می‌شود.
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-success">
                  <Check className="w-3.5 h-3.5" />
                  رزرو موجودی فقط برای سفارش سروری و حداکثر دو دقیقه است.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-1.5 text-[11px] text-info bg-info-light px-2.5 py-2 rounded-lg">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              این سبد فقط پیش‌نمایش است و موجودی رزرو نمی‌کند. سبد رسمی سروری در
              صفحهٔ «سبد» با حساب مشتری ثبت می‌شود.
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-600">جمع کالاها:</span>
            <span className="text-lg font-black text-ink-900">
              {formatPrice(subtotal)}
            </span>
          </div>
          {lines.length > 0 && step === "cart" ? (
            <button
              type="button"
              onClick={() => setStep("review")}
              className="w-full h-11 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-bold text-sm shadow-e1 flex items-center justify-center gap-1.5"
            >
              <span>ادامه و بررسی سفارش</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link
              href="/basket"
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-bold text-sm shadow-e1 flex items-center justify-center"
            >
              رفتن به سبد سروری
            </Link>
          )}
          {step === "review" && (
            <button
              type="button"
              onClick={() => setStep("cart")}
              className="w-full text-[11px] font-bold text-ink-500 hover:text-brand-500"
            >
              بازگشت به سبد
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
