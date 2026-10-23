import { useState, useMemo } from 'react';
import {
  Search,
  LayoutGrid,
  Grid3X3,
  ShoppingBag,
  Star,
  SlidersHorizontal,
  Send,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { CATEGORIES } from '../../data/products';
import type { CategorySlug, AudienceType } from '../../types';
import { cn } from '../../utils/cn';
import { formatPrice, formatNumber, discountPercent } from '../../utils/format';

interface ExploreViewProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function ExploreView({ searchQuery, onSearchChange }: ExploreViewProps) {
  const { products, posts, setSelectedPostId, addToRetailCart, showToast } = useStore();

  const [category, setCategory] = useState<CategorySlug | 'all'>('all');
  const [audience, setAudience] = useState<AudienceType | 'all'>('all');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'cheapest' | 'expensive' | 'popular'>(
    'featured'
  );
  const [displayMode, setDisplayMode] = useState<'shop' | 'mosaic'>('shop');
  const [requestText, setRequestText] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (category !== 'all' && p.categorySlug !== category) return false;
      if (audience !== 'all' && p.audience !== audience && p.audience !== 'یونیسکس') return false;
      if (onlyInStock && p.stock <= 0) return false;
      if (q) {
        const hay = `${p.name} ${p.categoryName} ${p.sku} ${p.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'cheapest') return a.price - b.price;
      if (sortBy === 'expensive') return b.price - a.price;
      if (sortBy === 'popular') return b.soldCount - a.soldCount;
      if (sortBy === 'newest')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
    });
  }, [products, category, audience, onlyInStock, searchQuery, sortBy]);

  const openProductModal = (productId: string) => {
    const post = posts.find((po) => po.productId === productId);
    if (post) setSelectedPostId(post.id);
  };

  return (
    <div className="w-full max-w-[960px] mx-auto space-y-4">
      {/* Search & Filter Panel */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-e1 space-y-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-ink-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="جست‌وجوی نام کالا، کد SKU یا برچسب..."
              className="w-full h-10 pr-10 pl-3 rounded-xl bg-canvas-sunken border border-border text-sm outline-none focus:border-brand-500 focus:bg-surface"
            />
          </div>

          <div className="flex items-center gap-1 bg-canvas-sunken p-1 rounded-xl border border-border text-xs font-bold">
            <button
              onClick={() => setDisplayMode('shop')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg flex items-center gap-1',
                displayMode === 'shop' ? 'bg-surface text-brand-500 shadow-e1' : 'text-ink-500'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              نمای فروشگاهی
            </button>
            <button
              onClick={() => setDisplayMode('mosaic')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg flex items-center gap-1',
                displayMode === 'mosaic' ? 'bg-surface text-brand-500 shadow-e1' : 'text-ink-500'
              )}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              موزاییک اکسپلور
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setCategory(cat.slug)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all flex items-center gap-1.5',
                category === cat.slug
                  ? 'bg-buy text-buy-fg border-buy shadow-e1'
                  : 'bg-canvas-sunken border-border text-ink-700 hover:bg-brand-50'
              )}
            >
              <span>{cat.nameFa}</span>
              {cat.badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold-500 text-[#211A2B] font-extrabold">
                  {cat.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-500 flex items-center gap-1 font-semibold">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              مخاطب:
            </span>
            {(['all', 'زنانه', 'مردانه', 'یونیسکس'] as const).map((aud) => (
              <button
                key={aud}
                onClick={() => setAudience(aud)}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-semibold',
                  audience === aud
                    ? 'bg-brand-50 text-brand-600 border border-brand-300'
                    : 'text-ink-600 hover:bg-canvas-sunken'
                )}
              >
                {aud === 'all' ? 'همه' : aud}
              </button>
            ))}

            <label className="flex items-center gap-1.5 mr-2 cursor-pointer font-semibold text-ink-700">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded accent-[#482780]"
              />
              فقط کالاهای موجود
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-ink-500">مرتب‌سازی:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-8 px-2.5 rounded-lg bg-canvas-sunken border border-border text-xs font-bold outline-none"
            >
              <option value="featured">پیشنهادی کیا</option>
              <option value="popular">پرفروش‌ترین</option>
              <option value="newest">جدیدترین</option>
              <option value="cheapest">ارزان‌ترین</option>
              <option value="expensive">گران‌ترین</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between px-1 text-xs text-ink-500">
        <span>
          نمایش <strong>{formatNumber(filtered.length)}</strong> کالا در دامنه استایل و مصرف شخصی کیا
        </span>
        <span>لباس زیر در کاتالوگ فعال است · پوشاک بیرونی عرضه نمی‌شود</span>
      </div>

      {/* Empty State with Product Request Form */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center space-y-4">
          <p className="font-extrabold text-base text-ink-900">
            کالایی با این عبارت یا فیلتر پیدا نشد
          </p>
          <p className="text-xs text-ink-500 max-w-md mx-auto">
            به ما بگویید دنبال چه مدل کیف، کفش، لباس زیر یا اکسسوری هستید تا تیم تأمین کیا به شما اطلاع دهد:
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!requestText.trim()) return;
              showToast('درخواست کالای شما برای واحد تأمین کیا ثبت شد!', 'success');
              setRequestText('');
            }}
            className="max-w-md mx-auto flex gap-2"
          >
            <input
              type="text"
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="مثلاً: کیف پول چرم طوسی یا سایز ۴۵ کتانی..."
              className="flex-1 h-10 px-3 rounded-xl bg-canvas-sunken border border-border text-xs outline-none"
            />
            <button
              type="submit"
              className="px-4 h-10 rounded-xl bg-buy text-buy-fg text-xs font-bold flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5 -scale-x-100" />
              ثبت درخواست
            </button>
          </form>
        </div>
      ) : displayMode === 'mosaic' ? (
        /* Instagram Explore Mosaic Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => openProductModal(product.id)}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-canvas-sunken border border-border text-right"
            >
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end text-white">
                <p className="text-xs font-extrabold line-clamp-1">{product.name}</p>
                <p className="text-xs font-black text-gold-300 mt-0.5">
                  {formatPrice(product.price)}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Secondary Shop Grid (/shop) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => {
            const disc = discountPercent(product.price, product.comparePrice);
            return (
              <div
                key={product.id}
                className="bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden flex flex-col hover:shadow-e2 transition-all"
              >
                <button
                  onClick={() => openProductModal(product.id)}
                  className="relative aspect-square bg-canvas-sunken overflow-hidden"
                >
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {disc > 0 && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-danger text-white text-[11px] font-extrabold">
                      {formatNumber(disc)}٪
                    </span>
                  )}
                </button>

                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-ink-500 mb-1">
                      <span>{product.categoryName}</span>
                      <span className="flex items-center gap-0.5 text-warning font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        {formatNumber(product.rating)}
                      </span>
                    </div>
                    <button
                      onClick={() => openProductModal(product.id)}
                      className="text-right font-extrabold text-sm text-ink-900 line-clamp-2 hover:text-brand-500"
                    >
                      {product.name}
                    </button>
                  </div>

                  <div className="flex items-end justify-between gap-2 pt-2 border-t border-border">
                    <div>
                      {product.comparePrice && (
                        <span className="text-[11px] text-ink-400 line-through block">
                          {formatPrice(product.comparePrice)}
                        </span>
                      )}
                      <span className="text-sm font-black text-ink-900">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        addToRetailCart(product.id, product.colors[0], product.sizes[0], 1)
                      }
                      className="px-3 py-2 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover text-xs font-bold flex items-center gap-1"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      خرید
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
