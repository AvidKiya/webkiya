import { Flame, Sparkles, PackageCheck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { cn } from '../../utils/cn';
import { formatNumber } from '../../utils/format';

export function StoriesBar() {
  const { stories, setActiveStoryId, orders, setRoute } = useStore();

  return (
    <section
      aria-label="کالکشن‌ها و دراپ‌های روز"
      className="bg-surface rounded-2xl border border-border p-3.5 md:p-4 shadow-e1"
    >
      <div className="flex gap-4 overflow-x-auto no-scrollbar items-start">
        {/* First Ring: My Orders / Quick Track */}
        <button
          onClick={() => setRoute('account')}
          className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] group"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-brand-400 bg-brand-50 flex items-center justify-center group-hover:scale-105 transition-transform">
              <PackageCheck className="w-6 h-6 text-brand-500" />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-buy text-buy-fg text-[9px] font-extrabold rounded-full whitespace-nowrap">
              {formatNumber(orders.length)} سفارش
            </span>
          </div>
          <span className="text-[11px] font-semibold text-ink-700 truncate w-full text-center">
            سفارش‌های من
          </span>
        </button>

        {/* Collection / Drop Stories */}
        {stories.map((story) => (
          <button
            key={story.id}
            onClick={() => setActiveStoryId(story.id)}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] group"
          >
            <div className="relative">
              <div
                className={cn(
                  'w-16 h-16 rounded-full p-[3px] transition-transform group-hover:scale-105',
                  story.seen
                    ? 'bg-ink-200'
                    : story.type === 'sale'
                      ? 'story-ring-live'
                      : 'story-ring'
                )}
              >
                <div className="w-full h-full rounded-full border-2 border-surface overflow-hidden bg-canvas-sunken">
                  <img
                    src={story.coverImage}
                    alt={story.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              {story.type === 'sale' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-danger text-white text-[9px] font-extrabold rounded-full flex items-center gap-0.5 whitespace-nowrap">
                  <Flame className="w-2.5 h-2.5" />
                  تخفیف
                </span>
              )}
              {story.type === 'drop' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-buy text-buy-fg text-[9px] font-extrabold rounded-full flex items-center gap-0.5 whitespace-nowrap">
                  <Sparkles className="w-2.5 h-2.5" />
                  دراپ
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-ink-800 truncate w-full text-center">
              {story.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
