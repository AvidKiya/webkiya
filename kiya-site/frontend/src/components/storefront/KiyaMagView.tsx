import { useState } from 'react';
import { BookOpen, Clock, ShoppingBag, ArrowRight } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatPrice, formatJalaliDate, formatNumber } from '../../utils/format';

export function KiyaMagView() {
  const { magIssues, products, posts, setSelectedPostId, addToRetailCart } = useStore();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const activeIssue = magIssues.find((m) => m.slug === selectedSlug);

  if (activeIssue) {
    return (
      <article className="w-full max-w-[820px] mx-auto bg-surface rounded-3xl border border-border shadow-e1 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <button
            onClick={() => setSelectedSlug(null)}
            className="text-xs font-extrabold text-brand-500 flex items-center gap-1.5 hover:underline"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به فهرست شماره‌های کیامگ</span>
          </button>
          <span className="text-xs text-ink-500">
            شماره {formatNumber(activeIssue.issueNumber)} · {activeIssue.readTime}
          </span>
        </div>

        <div className="aspect-[16/8] bg-canvas-sunken overflow-hidden">
          <img
            src={activeIssue.coverImage}
            alt={activeIssue.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-6 space-y-6">
          <div>
            <span className="text-xs font-bold text-gold-text bg-brand-50 px-2.5 py-1 rounded-full">
              تحریریه استایل کیا · {formatJalaliDate(activeIssue.publishedAt)}
            </span>
            <h1 className="text-xl md:text-2xl font-black text-ink-900 mt-3 leading-snug">
              {activeIssue.title}
            </h1>
            <p className="text-sm text-ink-600 mt-1.5">{activeIssue.subtitle}</p>
          </div>

          {activeIssue.sections.map((sec, idx) => (
            <section key={idx} className="space-y-3 pt-4 border-t border-border">
              <h2 className="text-base font-extrabold text-ink-900">{sec.heading}</h2>
              <p className="text-sm text-ink-700 leading-relaxed">{sec.body}</p>

              {/* Featured Live Products (Strictly Retail Price Only - F10!) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {sec.featuredProductIds.map((pid) => {
                  const prod = products.find((p) => p.id === pid);
                  if (!prod) return null;
                  return (
                    <div
                      key={prod.id}
                      className="p-3 rounded-2xl bg-canvas-sunken border border-border flex items-center gap-3"
                    >
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => {
                            const po = posts.find((x) => x.productId === prod.id);
                            if (po) setSelectedPostId(po.id);
                          }}
                          className="text-xs font-extrabold text-ink-900 hover:text-brand-500 text-right line-clamp-1"
                        >
                          {prod.name}
                        </button>
                        <p className="text-xs font-black text-brand-600 mt-1">
                          {formatPrice(prod.price)}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          addToRetailCart(prod.id, prod.colors[0], prod.sizes[0], 1)
                        }
                        className="p-2.5 rounded-xl bg-buy text-buy-fg shrink-0"
                        title="افزودن به سبد"
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  return (
    <div className="w-full max-w-[920px] mx-auto space-y-5">
      <div className="bg-surface rounded-3xl border border-border p-5 shadow-e1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-ink-900">مجله استایل و راهنمای خرید «کیامگ»</h1>
            <p className="text-xs text-ink-500">
              شماره‌های موضوعی با معرفی مستقیم کالاهای موجود در فروشگاه کیا
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {magIssues.map((issue) => (
          <div
            key={issue.id}
            className="bg-surface rounded-3xl border border-border shadow-e1 overflow-hidden flex flex-col"
          >
            <div className="aspect-[16/9] bg-canvas-sunken overflow-hidden">
              <img
                src={issue.coverImage}
                alt={issue.title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-ink-500">
                  <span className="font-extrabold text-brand-500">
                    شماره {formatNumber(issue.issueNumber)} کیامگ
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {issue.readTime}
                  </span>
                </div>
                <h2 className="font-extrabold text-base text-ink-900 leading-snug">
                  {issue.title}
                </h2>
                <p className="text-xs text-ink-600 leading-relaxed">{issue.excerpt}</p>
              </div>

              <button
                onClick={() => setSelectedSlug(issue.slug)}
                className="w-full py-2.5 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover text-xs font-extrabold"
              >
                مطالعه شماره و مشاهده محصولات منتخب
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
