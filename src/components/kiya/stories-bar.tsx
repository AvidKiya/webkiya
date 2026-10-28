import Link from "next/link";
import { PackageCheck } from "lucide-react";
import type { Product } from "@/lib/catalog";

/**
 * Collection rings, markup ported from the template's StoriesBar. Stories are
 * built from the live catalog categories so nothing here is invented content.
 */
export function KiyaStoriesBar({ products }: { products: Product[] }) {
  const groups = new Map<string, Product>();
  for (const product of products) {
    if (product.image && !groups.has(product.category)) {
      groups.set(product.category, product);
    }
  }
  const stories = [...groups.entries()].slice(0, 6);

  return (
    <section
      aria-label="کالکشن‌ها و دراپ‌های روز"
      className="bg-surface rounded-2xl border border-border p-3.5 md:p-4 shadow-e1"
    >
      <div className="flex gap-4 overflow-x-auto no-scrollbar items-start">
        <Link
          href="/account"
          className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] group"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-brand-400 bg-brand-50 flex items-center justify-center group-hover:scale-105 transition-transform">
              <PackageCheck className="w-6 h-6 text-brand-500" />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-buy text-buy-fg text-[9px] font-extrabold rounded-full whitespace-nowrap">
              سفارش‌های من
            </span>
          </div>
          <span className="text-[11px] font-semibold text-ink-700 truncate w-full text-center">
            سفارش‌ها
          </span>
        </Link>

        {stories.map(([category, product], index) => (
          <Link
            key={category}
            href={`/explore?category=${encodeURIComponent(category)}`}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] group"
          >
            <div className="relative">
              <div
                className={`w-16 h-16 rounded-full p-[3px] transition-transform group-hover:scale-105 ${
                  index === 0 ? "story-ring-live" : "story-ring"
                }`}
              >
                <div className="w-full h-full rounded-full border-2 border-surface overflow-hidden bg-canvas-sunken">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image}
                    alt={category}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              {index === 0 && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-danger text-white text-[9px] font-extrabold rounded-full whitespace-nowrap">
                  جدید
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-ink-800 truncate w-full text-center">
              {category}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
