"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ShoppingBag,
  BadgeCheck,
  Layers,
  Send,
  Info,
  ShieldAlert,
} from "lucide-react";
import type { Product } from "@/lib/catalog";
import { brandProfile } from "./brand";
import { cn, discountPercent, formatNumber, formatPrice } from "./kit";

/**
 * Feed card, markup ported from the template's PostCard but bound to the live
 * catalog: no invented ratings, sold counts or discounts — only the numbers the
 * shop actually stores.
 */
export function KiyaPostCard({
  product,
  liked,
  saved,
  onLike,
  onSave,
  onAdd,
  onOpen,
  onComment,
}: {
  product: Product;
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onSave: () => void;
  onAdd: (product: Product, color: string) => void;
  onOpen: () => void;
  onComment: () => void;
}) {
  const [selectedColor, setSelectedColor] = useState(
    product.colors.find((color) => color.available !== false)?.name ||
      product.colors[0]?.name ||
      "",
  );
  const [expanded, setExpanded] = useState(false);
  const [bigHeart, setBigHeart] = useState(false);
  const lastTap = useRef(0);

  const discount = discountPercent(product.price, product.previous);
  const availableColors = product.colors.filter(
    (color) => color.available !== false,
  );
  const soldOut = availableColors.length === 0;
  const chosen = product.colors.find((color) => color.name === selectedColor);

  function openCard() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) onLike();
      setBigHeart(true);
      window.setTimeout(() => setBigHeart(false), 800);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    onOpen();
  }

  function share() {
    const url = `${window.location.origin}/p/${product.id}`;
    void navigator.clipboard?.writeText(url).catch(() => {});
  }

  return (
    <article
      data-post={product.id}
      className="post-card bg-surface md:rounded-2xl border-y md:border border-border shadow-e1 overflow-hidden transition-shadow hover:shadow-e2"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href="/profile"
          className="flex items-center gap-2.5 text-right group"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#482780] border border-gold-500/40 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandProfile}
              alt="کیا — KIYA"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-ink-900 group-hover:text-brand-500 transition-colors">
                کیا — KIYA
              </span>
              <BadgeCheck className="w-4 h-4 text-brand-500" />
              {product.tag && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-500 border border-brand-200">
                  {product.tag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <span>{product.category}</span>
              <span>·</span>
              <span>{product.collection || product.subtitle}</span>
            </div>
          </div>
        </Link>

        <span className="text-[11px] font-mono text-ink-400 bg-canvas-sunken px-2 py-1 rounded-lg">
          <bdi>{product.isDemo ? "DEMO" : product.id.slice(0, 8)}</bdi>
        </span>
      </div>

      <button
        type="button"
        onClick={openCard}
        className="relative w-full aspect-square bg-canvas-sunken cursor-pointer select-none overflow-hidden group block"
        aria-label={`تصویر ${product.name}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
          loading="lazy"
        />

        {bigHeart && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart className="w-24 h-24 text-white fill-white big-heart drop-shadow-lg" />
          </span>
        )}

        <span className="absolute top-3 right-3 flex flex-col gap-1.5 z-10 items-start">
          {discount > 0 && (
            <span className="px-2.5 py-1 bg-danger text-white text-xs font-extrabold rounded-full shadow-md">
              {formatNumber(discount)}٪ تخفیف
            </span>
          )}
          {soldOut && (
            <span className="px-2.5 py-1 bg-[#211A2B] text-white text-[11px] font-bold rounded-full shadow-md">
              فعلاً ناموجود
            </span>
          )}
        </span>
      </button>

      <div className="p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onLike}
              className="flex items-center gap-1.5 text-sm font-bold text-ink-700 hover:text-brand-500 transition-colors"
              aria-label="پسندیدن کالا"
              aria-pressed={liked}
            >
              <Heart
                className={cn(
                  "w-5 h-5 transition-transform",
                  liked && "fill-danger text-danger heart-pop",
                )}
              />
            </button>

            <button
              type="button"
              onClick={onComment}
              className="flex items-center gap-1.5 text-sm font-bold text-ink-700 hover:text-brand-500 transition-colors"
              aria-label="مشاهده دیدگاه‌ها"
            >
              <MessageCircle className="w-5 h-5" />
              <span>دیدگاه‌ها</span>
            </button>

            <button
              type="button"
              onClick={share}
              className="text-ink-700 hover:text-brand-500 transition-colors"
              aria-label="کپی لینک کالا"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onSave}
            className="text-ink-700 hover:text-brand-500 transition-colors"
            aria-label="ذخیره کالا"
            aria-pressed={saved}
          >
            <Bookmark
              className={cn(
                "w-5 h-5",
                saved && "fill-brand-500 text-brand-500",
              )}
            />
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={onOpen}
            className="text-right font-extrabold text-[16px] text-ink-900 hover:text-brand-500 transition-colors leading-snug"
          >
            {product.name}
          </button>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-ink-500">
            <span className="text-ink-700 font-semibold">
              {product.subtitle}
            </span>
            <span>·</span>
            <span>{formatNumber(availableColors.length)} رنگ موجود</span>
            {product.packSize > 1 && (
              <>
                <span>·</span>
                <span>جین {formatNumber(product.packSize)} عددی</span>
              </>
            )}
          </div>
        </div>

        <div className="text-sm text-ink-700 leading-relaxed">
          <p className={cn(!expanded && "line-clamp-2")}>
            {product.description}
          </p>

          {expanded && product.colors.length > 0 && (
            <div className="mt-2.5 p-3 rounded-xl bg-canvas-sunken border border-border space-y-2 text-xs text-ink-700">
              <p className="font-semibold text-ink-900">رنگ‌های تعریف‌شده</p>
              <div className="flex flex-wrap gap-1.5">
                {product.colors.map((color) => (
                  <span
                    key={color.name}
                    className="inline-flex items-center gap-1 bg-surface px-2 py-0.5 rounded-md border border-border"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/10"
                      style={{ background: color.hex }}
                    />
                    {color.name}
                    {color.available === false && (
                      <span className="text-ink-400">(ناموجود)</span>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex items-start gap-1.5 text-[11px] text-brand-600 bg-brand-50 p-2 rounded-lg">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  قیمت‌ها و مشخصات این کالا در پایگاه داده فروشگاه ثبت شده است؛
                  پیش از فروش واقعی باید توسط صاحب فروشگاه تأیید شود.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-1.5">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="text-xs font-extrabold text-brand-500 hover:underline"
            >
              {expanded ? "کمتر" : "بیشتر..."}
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="text-xs font-semibold text-ink-500 hover:text-brand-500 flex items-center gap-1"
            >
              <Info className="w-3.5 h-3.5" />
              <span>مشخصات کامل</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-500 ml-1">رنگ:</span>
            {product.colors.map((color) => (
              <button
                key={color.name}
                type="button"
                disabled={color.available === false}
                onClick={() => setSelectedColor(color.name)}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40 disabled:line-through",
                  selectedColor === color.name
                    ? "border-brand-500 bg-brand-50 text-brand-600"
                    : "border-border text-ink-600 hover:border-ink-300",
                )}
              >
                {color.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-3 bg-canvas-sunken rounded-2xl border border-border-subtle">
          <div>
            {product.previous && (
              <span className="text-xs text-ink-400 line-through block">
                {formatPrice(product.previous)}
              </span>
            )}
            <span className="text-lg font-black text-ink-900">
              {formatPrice(product.price)}
            </span>
          </div>

          <button
            type="button"
            disabled={soldOut}
            onClick={() => onAdd(product, selectedColor || chosen?.name || "")}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95",
              soldOut
                ? "bg-surface border border-border text-ink-700"
                : "bg-buy text-buy-fg hover:bg-buy-hover shadow-e1",
            )}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{soldOut ? "فعلاً ناموجود" : "افزودن به سبد"}</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-ink-500 px-1">
          <span>
            خرید عمده جینی (حداقل ۱ جین): قیمت عمده فقط برای حساب همکار تأییدشده
            نمایش داده می‌شود.
          </span>
          <Link
            href="/wholesale"
            className="text-brand-500 font-bold hover:underline shrink-0 mr-2"
          >
            درخواست همکاری
          </Link>
        </div>

        <div className="pt-2.5 border-t border-border">
          <button
            type="button"
            onClick={onComment}
            className="w-full flex items-center gap-2 h-9 px-3 rounded-xl bg-canvas-sunken text-xs text-ink-500 hover:text-brand-500 transition-colors"
          >
            <Send className="w-3.5 h-3.5 -scale-x-100" />
            <span>پرسش یا دیدگاه درباره این کالا بنویسید…</span>
            <Layers className="w-3.5 h-3.5 mr-auto" />
          </button>
        </div>
      </div>
    </article>
  );
}
