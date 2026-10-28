"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X, ShoppingBag, Layers, BadgeCheck, ShieldAlert } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { ServerComments } from "@/components/server-comments";
import { CartAddButton } from "@/components/server-basket";
import { KiyaProvider, useKiya } from "./context";
import { KiyaHeader } from "./header";
import { KiyaNavRail } from "./nav-rail";
import { KiyaBottomNav } from "./bottom-nav";
import { KiyaRightRail } from "./right-rail";
import { KiyaCartSheet } from "./cart-sheet";
import { KiyaFeed, KiyaExplore } from "./feed";
import {
  KiyaAccount,
  KiyaBasket,
  KiyaInbox,
  KiyaMag,
  KiyaProfile,
  KiyaSaved,
  KiyaWholesale,
} from "./views";
import { brandProfile } from "./brand";
import { cn, discountPercent, formatNumber, formatPrice } from "./kit";

function ProductDialog() {
  const { products, postId, openPost, addToCart, saved, toggleSaved } =
    useKiya();
  const product = products.find((item) => item.id === postId);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!product) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") openPost(null);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [product, openPost]);

  if (!product) return null;
  const discount = discountPercent(product.price, product.previous);
  const available = product.colors.filter((color) => color.available !== false);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-6">
      <button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 bg-[#141018]/70 backdrop-blur-sm"
        onClick={() => openPost(null)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        className="relative w-full max-w-[940px] max-h-[94vh] bg-surface rounded-none md:rounded-3xl shadow-e4 overflow-hidden modal-in grid md:grid-cols-2"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => openPost(null)}
          className="absolute top-3 left-3 z-20 w-9 h-9 rounded-xl bg-surface/90 backdrop-blur text-ink-700 flex items-center justify-center hover:bg-canvas-sunken"
          aria-label="بستن جزئیات کالا"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="bg-canvas-sunken relative aspect-square md:aspect-auto md:h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {discount > 0 && (
            <span className="absolute top-3 right-3 px-2.5 py-1 bg-danger text-white text-xs font-extrabold rounded-full">
              {formatNumber(discount)}٪ تخفیف
            </span>
          )}
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#482780] border border-gold-500/40 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brandProfile}
                alt="کیا"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-ink-900">
                  کیا — KIYA
                </span>
                <BadgeCheck className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-[11px] text-ink-500">
                {product.category} · {product.collection || product.subtitle}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-black text-ink-900 leading-snug">
              {product.subtitle || product.name}
            </h2>
            <p className="text-xs text-ink-500">{product.name}</p>
          </div>

          <p className="text-xs text-ink-700 leading-relaxed">
            {product.description}
          </p>

          <div className="space-y-2">
            <span className="text-xs text-ink-500">رنگ‌های موجود:</span>
            <div className="flex flex-wrap gap-1.5">
              {product.colors.map((color) => (
                <span
                  key={color.name}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold",
                    color.available === false
                      ? "border-border text-ink-400 line-through"
                      : "border-brand-200 bg-brand-50 text-brand-600",
                  )}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/10"
                    style={{ background: color.hex }}
                  />
                  {color.name}
                </span>
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
              disabled={available.length === 0}
              onClick={() => addToCart(product, available[0]?.name || "")}
              className="px-4 py-2.5 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover text-sm font-bold flex items-center gap-2 disabled:opacity-40"
            >
              <ShoppingBag className="w-4 h-4" />
              افزودن به سبد
            </button>
          </div>

          {!product.isDemo && available[0]?.id && (
            <div className="rounded-2xl border border-border bg-canvas-sunken/60 p-3 space-y-1.5">
              <p className="text-xs font-extrabold text-ink-900">
                ثبت در سبد سروری (با حساب مشتری)
              </p>
              <p className="text-[11px] text-ink-500 leading-relaxed">
                این سبد در پایگاه داده ذخیره می‌شود و موجودی را رزرو نمی‌کند.
              </p>
              <CartAddButton mode="RETAIL" itemId={available[0].id} />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSaved(product.id)}
              className="px-3 py-2 rounded-xl bg-canvas-sunken border border-border text-xs font-bold text-ink-700"
            >
              {saved.includes(product.id) ? "حذف از ذخیره‌ها" : "ذخیره کالا"}
            </button>
            <Link
              href="/wholesale"
              className="px-3 py-2 rounded-xl bg-canvas-sunken border border-border text-xs font-bold text-ink-700 flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              خرید عمده
            </Link>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-brand-600 bg-brand-50 p-2.5 rounded-lg">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              قیمت و مشخصات این کالا از پایگاه دادهٔ فروشگاه خوانده شده است؛ پیش
              از فروش واقعی باید توسط صاحب فروشگاه تأیید شود.
            </span>
          </div>

          <div className="pt-3 border-t border-border">
            <h3 className="font-extrabold text-sm text-ink-900 mb-2">
              دیدگاه‌ها
            </h3>
            <ServerComments postId={product.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ section }: { section: string }) {
  const {
    products,
    cart,
    cartCount,
    theme,
    toggleTheme,
    setQuantity,
    removeItem,
    cartOpen,
    setCartOpen,
    query,
    setQuery,
    offline,
    storageWarning,
    toast,
    postId,
  } = useKiya();
  const [loadingMore] = useState(false);

  const view =
    section === "home" ? (
      <KiyaFeed />
    ) : section === "explore" ? (
      <KiyaExplore />
    ) : section === "saved" ? (
      <KiyaSaved />
    ) : section === "wholesale" ? (
      <KiyaWholesale />
    ) : section === "profile" ? (
      <KiyaProfile />
    ) : section === "inbox" ? (
      <KiyaInbox />
    ) : section === "mag" ? (
      <KiyaMag />
    ) : section === "basket" ? (
      <KiyaBasket />
    ) : (
      <KiyaAccount />
    );

  return (
    <div data-kiya-shell="v1" className="min-h-screen bg-canvas flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-buy focus:text-buy-fg font-bold text-xs"
      >
        پرش به محتوای اصلی
      </a>

      {offline && (
        <div className="bg-danger text-white text-xs font-bold px-4 py-2 text-center">
          اتصال اینترنت قطع است؛ محتوای ذخیره‌شده نمایش داده می‌شود.
        </div>
      )}
      {storageWarning && (
        <div className="bg-warning text-white text-xs font-bold px-4 py-2 text-center">
          ذخیره‌سازی مرورگر در دسترس نیست؛ تغییرات پس از بستن صفحه باقی
          نمی‌ماند.
        </div>
      )}

      <KiyaHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        query={query}
        onQueryChange={setQuery}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
      />

      <div className="max-w-[1440px] w-full mx-auto px-0 md:px-4 lg:px-6 py-3 md:py-5 pb-24 md:pb-10 flex-1">
        <div className="flex gap-5 items-start justify-center">
          <KiyaNavRail inert={Boolean(postId) || cartOpen} />
          <main id="main-content" className="flex-1 min-w-0">
            {view}
          </main>
          {(section === "home" || section === "explore") && (
            <KiyaRightRail
              products={products}
              cart={cart}
              onQuantity={setQuantity}
              onCheckout={() => setCartOpen(true)}
              inert={Boolean(postId) || cartOpen}
            />
          )}
        </div>
      </div>

      <KiyaBottomNav
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
      />

      <KiyaCartSheet
        open={cartOpen}
        products={products}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onQuantity={setQuantity}
        onRemove={removeItem}
      />

      <ProductDialog />

      {loadingMore && <span className="sr-only">در حال بارگذاری</span>}

      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-20 md:bottom-6 right-1/2 translate-x-1/2 md:right-6 md:translate-x-0 z-[130] px-4 py-2.5 rounded-xl text-xs font-bold shadow-e3",
            toast.kind === "success" && "bg-[#12B76A] text-white",
            toast.kind === "info" && "bg-[#211A2B] text-white",
            toast.kind === "warning" && "bg-[#D97706] text-white",
            toast.kind === "error" && "bg-[#B4233D] text-white",
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default function KiyaStore({
  section,
  catalog,
  initialPost,
  initialQuery,
}: {
  section: string;
  initialPost?: string;
  initialQuery?: string;
  catalog: Product[];
}) {
  return (
    <KiyaProvider
      products={catalog}
      initialPost={initialPost}
      initialQuery={initialQuery}
    >
      <Shell section={section} />
    </KiyaProvider>
  );
}
