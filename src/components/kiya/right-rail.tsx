"use client";

import Link from "next/link";
import {
  ShoppingBag,
  Sparkles,
  ArrowLeft,
  Send,
  CreditCard,
  Truck,
  Boxes,
  RotateCcw,
} from "lucide-react";
import type { CartItem, Product } from "@/lib/catalog";
import { cn, formatNumber, formatPrice } from "./kit";

/**
 * Left rail of the feed, ported from the template's RightRail. The "live pulse"
 * card of the template showed fabricated sales events, so it is replaced by an
 * honest readiness card carrying the same visual weight.
 */
export function KiyaRightRail({
  products,
  cart,
  onQuantity,
  onCheckout,
  inert = false,
}: {
  products: Product[];
  cart: CartItem[];
  onQuantity: (item: CartItem, delta: number) => void;
  onCheckout: () => void;
  inert?: boolean;
}) {
  const lines = cart
    .map((item) => ({
      item,
      product: products.find((product) => product.id === item.productId),
    }))
    .filter((line): line is { item: CartItem; product: Product } =>
      Boolean(line.product),
    );
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line.product.price) * line.item.qty,
    0,
  );
  const available = products.filter((product) =>
    product.colors.some((color) => color.available !== false),
  ).length;

  const status = [
    {
      icon: CreditCard,
      label: "پرداخت آنلاین",
      value: "فعال نشده",
      tone: "bg-warning-light text-warning",
    },
    {
      icon: Truck,
      label: "ارسال و مرسوله",
      value: "قواعد پیش‌نویس",
      tone: "bg-info-light text-info",
    },
    {
      icon: Boxes,
      label: "کالای آمادهٔ فروش",
      value: `${formatNumber(available)} کالا`,
      tone: "bg-brand-50 text-brand-500",
    },
    {
      icon: RotateCcw,
      label: "بازگشت کالا",
      value: "طبق ضوابط بهداشتی",
      tone: "bg-success-light text-success",
    },
  ];

  return (
    <aside
      inert={inert}
      className="hidden lg:flex flex-col w-[320px] shrink-0 sticky top-[104px] space-y-4 self-start"
    >
      <div className="bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-brand-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-brand-500" />
            <span className="font-extrabold text-sm text-ink-900">
              سبد خرید تکی
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-buy text-buy-fg text-[11px] font-bold">
            {formatNumber(count)} عدد
          </span>
        </div>

        {lines.length === 0 ? (
          <div className="p-6 text-center space-y-1.5">
            <ShoppingBag className="w-8 h-8 text-ink-300 mx-auto" />
            <p className="text-xs font-bold text-ink-700">
              سبد خرید تو خالی است
            </p>
            <p className="text-[11px] text-ink-500">
              از فید یا اکسپلور، رنگ مورد نظرت را انتخاب کن و به سبد اضافه کن.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border max-h-[250px] overflow-y-auto">
              {lines.map(({ item, product }) => (
                <div key={product.id + item.color} className="p-3 flex gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink-900 truncate">
                      {product.name}
                    </p>
                    <p className="text-[10px] text-ink-500 truncate">
                      {item.color}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onQuantity(item, -1)}
                          className="w-6 h-6 rounded bg-canvas-sunken text-xs font-bold"
                          aria-label="کاهش تعداد"
                        >
                          −
                        </button>
                        <span className="text-xs font-extrabold px-1.5">
                          {formatNumber(item.qty)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onQuantity(item, 1)}
                          className="w-6 h-6 rounded bg-canvas-sunken text-xs font-bold"
                          aria-label="افزایش تعداد"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-extrabold text-ink-900">
                        {formatPrice(Number(product.price) * item.qty)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3.5 border-t border-border space-y-2.5 bg-canvas-sunken/40">
              <div className="text-[11px] text-info bg-info-light px-2.5 py-1.5 rounded-lg">
                این سبد پیش‌نمایشی است؛ سبد رسمی و رزرو موجودی در صفحهٔ سبد
                سروری انجام می‌شود.
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-600">جمع کالاها:</span>
                <span className="text-base font-black text-ink-900">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={onCheckout}
                className="w-full py-2.5 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-bold text-xs shadow-e1"
              >
                ادامه و بررسی سبد
              </button>
            </div>
          </>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="font-extrabold text-xs text-ink-900">
            وضعیت آمادگی فروشگاه
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-canvas-sunken text-ink-500">
            شفاف
          </span>
        </div>
        <div className="p-2.5 space-y-1">
          {status.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-canvas-sunken transition-colors"
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    row.tone,
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-ink-800 leading-snug">
                    {row.label}
                  </p>
                  <span className="text-[10px] text-ink-400">{row.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-gradient-to-br from-[#482780] to-[#2D1654] text-white shadow-e2 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gold-300">
            <Sparkles className="w-4 h-4" />
            فروش عمده جینی همکاران
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 font-bold">
            حداقل ۱ جین
          </span>
        </div>
        <p className="text-xs text-white/85 leading-relaxed">
          صاحب فروشگاه یا پیج هستید؟ پس از تأیید حساب همکاری، قیمت واحد عمده و
          ترکیب دقیق جین هر کالا برایتان باز می‌شود.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href="/wholesale"
            className="py-2 px-2.5 rounded-xl bg-gold-500 text-[#211A2B] font-extrabold text-[11px] flex items-center justify-center gap-1"
          >
            <span>پورتال همکاران</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/inbox"
            className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] flex items-center justify-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span>پشتیبانی</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
