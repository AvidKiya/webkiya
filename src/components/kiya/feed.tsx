"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Sparkles,
  Layers,
  ArrowLeft,
  ShieldCheck,
  Truck,
  RotateCcw,
  BookOpen,
  Search,
  LayoutGrid,
  SlidersHorizontal,
  ShoppingBag,
  Bookmark,
} from "lucide-react";
import type { Product } from "@/lib/catalog";
import { useKiya } from "./context";
import { KiyaPostCard } from "./post-card";
import { KiyaStoriesBar } from "./stories-bar";
import { cn, formatNumber, formatPrice } from "./kit";

const serviceCards = [
  { icon: ShieldCheck, title: "تک‌فروشنده رسمی", desc: "تضمین اصالت و سلامت" },
  { icon: Truck, title: "ارسال سریع", desc: "پیک تهران و پیشتاز" },
  { icon: RotateCcw, title: "۷ روز ضمانت", desc: "طبق ضوابط بهداشتی کالا" },
  { icon: BookOpen, title: "مجله کیامگ", desc: "راهنمای تخصصی استایل" },
];

function StoreFooter() {
  return (
    <footer className="site-footer px-3 md:px-0 pt-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {serviceCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-surface rounded-2xl border border-border p-3 flex items-center gap-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-ink-900 truncate">
                  {card.title}
                </p>
                <p className="text-[10px] text-ink-500 truncate">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center text-[11px] text-ink-400 space-y-1.5 pb-2">
        <p>
          کیا — <bdi>KIYA</bdi> · <bdi>kiyaco24.ir</bdi> · کاتالوگ فعلی نمونهٔ
          آزمایشی است
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/about" className="hover:text-brand-500">
            دربارهٔ کیا
          </Link>
          <Link href="/wholesale" className="hover:text-brand-500">
            همکاری عمده جینی
          </Link>
          <Link href="/inbox" className="hover:text-brand-500">
            پشتیبانی
          </Link>
          <Link href="/mag" className="hover:text-brand-500">
            کیامگ
          </Link>
          <Link href="/faq" className="hover:text-brand-500">
            پرسش‌های متداول
          </Link>
          <Link href="/shipping" className="hover:text-brand-500">
            ارسال و مرجوعی
          </Link>
          <Link href="/admin/preview" className="hover:text-brand-500">
            نمایش مدیریت (فقط خواندنی)
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function KiyaFeed() {
  const {
    products,
    liked,
    saved,
    toggleLiked,
    toggleSaved,
    addToCart,
    openPost,
  } = useKiya();
  const [limit, setLimit] = useState(6);
  const visible = products.slice(0, limit);
  const remaining = products.length - limit;

  if (products.length === 0) {
    return (
      <div className="max-w-[630px] mx-auto px-3">
        <div className="bg-surface rounded-2xl border border-border p-8 text-center space-y-2 shadow-e1">
          <ShoppingBag className="w-10 h-10 text-ink-300 mx-auto" />
          <p className="font-extrabold text-ink-900">هنوز کالایی منتشر نشده</p>
          <p className="text-xs text-ink-500">
            کالاهای منتشرشده از پنل مدیریت همین‌جا در فید نمایش داده می‌شوند.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[630px] mx-auto space-y-4 md:space-y-6">
      <div className="px-3 md:px-0">
        <KiyaStoriesBar products={products} />
      </div>

      <div className="flex items-center justify-between px-4 md:px-1">
        <h1 className="font-extrabold text-sm md:text-base text-ink-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold-500" />
          <span>فید زنده کیا — هر روز جدید، بدون واسطه</span>
        </h1>
        <Link
          href="/explore"
          className="text-xs text-brand-500 font-bold hover:underline shrink-0"
        >
          نمای گرید فروشگاهی
        </Link>
      </div>

      {visible.map((product, index) => (
        <div key={product.id} className="space-y-4 md:space-y-6">
          <KiyaPostCard
            product={product}
            liked={liked.includes(product.id)}
            saved={saved.includes(product.id)}
            onLike={() => toggleLiked(product.id)}
            onSave={() => toggleSaved(product.id)}
            onAdd={addToCart}
            onOpen={() => openPost(product.id)}
            onComment={() => openPost(product.id)}
          />

          {index === 2 && (
            <div className="mx-3 md:mx-0 rounded-2xl bg-gradient-to-l from-[#482780] via-[#381C68] to-[#211A2B] text-white p-5 shadow-e2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gold-500 text-[#211A2B]">
                  <Layers className="w-3 h-3" />
                  ویژه همکاران سراسر کشور
                </span>
                <h2 className="font-black text-base">
                  خرید عمده جینی مستقیم از انبار کیا — حداقل سفارش فقط ۱ جین!
                </h2>
                <p className="text-xs text-white/80">
                  بدون حداقل مبلغ اضافه · ترکیب شفاف سایز و رنگ هر بسته · حفظ
                  کامل محرمانگی قیمت همکار
                </p>
              </div>
              <Link
                href="/wholesale"
                className="px-4 py-2.5 rounded-xl bg-white text-[#211A2B] font-extrabold text-xs flex items-center gap-1.5 shrink-0"
              >
                <span>ورود به بخش عمده</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      ))}

      {remaining > 0 && (
        <div className="text-center py-2 px-3">
          <button
            type="button"
            onClick={() => setLimit((value) => value + 6)}
            className="px-6 py-2.5 rounded-xl bg-surface border border-border text-xs font-extrabold text-ink-800 hover:bg-brand-50 transition-colors shadow-e1"
          >
            نمایش کالاهای بیشتر ({formatNumber(remaining)} مورد باقی‌مانده)
          </button>
        </div>
      )}

      <StoreFooter />
    </div>
  );
}

export function ProductTile({ product }: { product: Product }) {
  const { saved, toggleSaved, addToCart, openPost } = useKiya();
  const available = product.colors.filter((color) => color.available !== false);
  const isSaved = saved.includes(product.id);

  return (
    <div
      data-product-tile={product.id}
      className="bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden group flex flex-col"
    >
      <button
        type="button"
        onClick={() => openPost(product.id)}
        className="relative aspect-square overflow-hidden bg-canvas-sunken"
        aria-label={product.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.previous && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-danger text-white text-[10px] font-extrabold">
            تخفیف
          </span>
        )}
        {available.length === 0 && (
          <span className="absolute inset-0 bg-[#141018]/55 text-white text-xs font-extrabold flex items-center justify-center">
            فعلاً ناموجود
          </span>
        )}
      </button>

      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => openPost(product.id)}
            className="text-right text-xs font-extrabold text-ink-900 leading-snug line-clamp-2 hover:text-brand-500"
          >
            {product.name}
          </button>
          <button
            type="button"
            onClick={() => toggleSaved(product.id)}
            className="text-ink-400 hover:text-brand-500 shrink-0"
            aria-label="ذخیره کالا"
            aria-pressed={isSaved}
          >
            <Bookmark
              className={cn(
                "w-4 h-4",
                isSaved && "fill-brand-500 text-brand-500",
              )}
            />
          </button>
        </div>
        <p className="text-[10px] text-ink-500">{product.category}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div>
            {product.previous && (
              <span className="block text-[10px] text-ink-400 line-through">
                {formatPrice(product.previous)}
              </span>
            )}
            <span className="text-xs font-black text-ink-900">
              {formatPrice(product.price)}
            </span>
          </div>
          <button
            type="button"
            disabled={available.length === 0}
            onClick={() => addToCart(product, available[0]?.name || "")}
            className="w-8 h-8 rounded-xl bg-buy text-buy-fg flex items-center justify-center disabled:opacity-40"
            aria-label={`افزودن ${product.name} به سبد`}
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function KiyaExplore() {
  const params = useSearchParams();
  const urlCategory = params.get("category") || "همه";
  return <ExploreBody key={urlCategory} initialCategory={urlCategory} />;
}

function ExploreBody({ initialCategory }: { initialCategory: string }) {
  const { products, query, setQuery } = useKiya();
  const [category, setCategory] = useState(initialCategory);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sort, setSort] = useState<"featured" | "cheap" | "expensive">(
    "featured",
  );

  const categories = useMemo(
    () => ["همه", ...new Set(products.map((product) => product.category))],
    [products],
  );

  const visible = useMemo(() => {
    const needle = query.trim();
    return products
      .filter((product) => {
        if (category !== "همه" && product.category !== category) return false;
        if (
          onlyAvailable &&
          !product.colors.some((color) => color.available !== false)
        )
          return false;
        if (!needle) return true;
        return `${product.name} ${product.subtitle} ${product.category} ${product.description}`.includes(
          needle,
        );
      })
      .sort((a, b) => {
        if (sort === "cheap") return Number(a.price) - Number(b.price);
        if (sort === "expensive") return Number(b.price) - Number(a.price);
        return 0;
      });
  }, [products, category, onlyAvailable, query, sort]);

  return (
    <div className="w-full max-w-[960px] mx-auto space-y-4">
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-e1 space-y-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-ink-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی نام کالا، دسته یا برچسب..."
              aria-label="جست‌وجو در فروشگاه"
              className="w-full h-10 pr-10 pl-3 rounded-xl bg-canvas-sunken border border-border text-sm outline-none focus:border-brand-500 focus:bg-surface"
            />
          </div>

          <div className="flex items-center gap-1 bg-canvas-sunken p-1 rounded-xl border border-border text-xs font-bold">
            <button
              type="button"
              onClick={() => setSort("featured")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg flex items-center gap-1",
                sort === "featured"
                  ? "bg-surface text-brand-500 shadow-e1"
                  : "text-ink-500",
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              پیشنهاد کیا
            </button>
            <button
              type="button"
              onClick={() => setSort("cheap")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg",
                sort === "cheap"
                  ? "bg-surface text-brand-500 shadow-e1"
                  : "text-ink-500",
              )}
            >
              ارزان‌ترین
            </button>
            <button
              type="button"
              onClick={() => setSort("expensive")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg",
                sort === "expensive"
                  ? "bg-surface text-brand-500 shadow-e1"
                  : "text-ink-500",
              )}
            >
              گران‌ترین
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                category === item
                  ? "bg-buy text-buy-fg border-buy shadow-e1"
                  : "bg-canvas-sunken border-border text-ink-700 hover:bg-brand-50",
              )}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOnlyAvailable((value) => !value)}
            aria-pressed={onlyAvailable}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all mr-auto",
              onlyAvailable
                ? "bg-brand-500 text-white border-brand-500"
                : "bg-canvas-sunken border-border text-ink-700 hover:bg-brand-50",
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            فقط موجود
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center space-y-2">
          <Search className="w-10 h-10 text-ink-300 mx-auto" />
          <p className="font-extrabold text-ink-900">کالایی پیدا نشد</p>
          <p className="text-xs text-ink-500">
            فیلترها را تغییر بده یا عبارت دیگری جست‌وجو کن.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-4">
          {visible.map((product) => (
            <ProductTile key={product.id} product={product} />
          ))}
        </div>
      )}

      <StoreFooter />
    </div>
  );
}

export function KiyaSaved() {
  const { products, saved } = useKiya();
  const list = products.filter((product) => saved.includes(product.id));

  return (
    <div className="w-full max-w-[960px] mx-auto space-y-4">
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-e1">
        <h1 className="font-black text-lg text-ink-900">
          چیزهایی که دوست داری
        </h1>
        <p className="text-xs text-ink-500 mt-1">
          انتخاب‌های ذخیره‌شده در همین مرورگر نگه داشته می‌شوند.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center space-y-2">
          <Bookmark className="w-10 h-10 text-ink-300 mx-auto" />
          <p className="font-extrabold text-ink-900">
            هنوز چیزی ذخیره نکرده‌ای
          </p>
          <p className="text-xs text-ink-500">
            روی نشانک هر کالا در فید یا اکسپلور بزن تا اینجا جمع شود.
          </p>
          <Link
            href="/explore"
            className="inline-flex mt-2 px-4 py-2 rounded-xl bg-buy text-buy-fg text-xs font-bold"
          >
            رفتن به اکسپلور
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-4">
          {list.map((product) => (
            <ProductTile key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
