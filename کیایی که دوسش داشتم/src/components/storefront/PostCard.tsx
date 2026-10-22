import { useState, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Star,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Layers,
  Info,
  Minus,
  Plus,
  Send,
  ShieldAlert,
} from 'lucide-react';
import type { Post } from '../../types';
import { useStore } from '../../context/StoreContext';
import { brandProfile } from '../shared/Logo';
import { cn } from '../../utils/cn';
import {
  formatPrice,
  formatNumber,
  formatRelativeTime,
  discountPercent,
} from '../../utils/format';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const {
    products,
    comments,
    salesMode,
    isApprovedPartner,
    toggleLikePost,
    toggleSavePost,
    addToRetailCart,
    addToWholesaleCart,
    setSelectedPostId,
    setRoute,
    addComment,
    showToast,
  } = useStore();

  const product = products.find((p) => p.id === post.productId);
  if (!product) return null;

  const [imgIdx, setImgIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [packCount, setPackCount] = useState(1);
  const [expandedL1, setExpandedL1] = useState(false);
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [quickComment, setQuickComment] = useState('');
  const lastClickTime = useRef(0);

  const postComments = comments.filter((c) => c.postId === post.id);
  const discount = discountPercent(product.price, product.comparePrice);
  const isWholesaleView = salesMode === 'WHOLESALE' && isApprovedPartner;
  const pack = product.packDefinition;
  const maxPacks = Math.floor(product.stock / pack.unitsPerPack);
  const packTotalPrice = pack.wholesaleUnitPriceToman * pack.unitsPerPack;

  const handleMediaClick = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 300) {
      if (!post.isLiked) toggleLikePost(post.id);
      setShowBigHeart(true);
      setTimeout(() => setShowBigHeart(false), 800);
    } else {
      setSelectedPostId(post.id);
    }
    lastClickTime.current = now;
  };

  const handleShare = () => {
    const shareUrl = `https://kiyaco24.ir/p/${post.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    showToast('لینک مستقیم پست کپی شد', 'info');
  };

  return (
    <article className="bg-surface md:rounded-2xl border-y md:border border-border shadow-e1 overflow-hidden transition-shadow hover:shadow-e2">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setRoute('profile')}
          className="flex items-center gap-2.5 text-right group"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#482780] border border-gold-500/40 shrink-0">
            <img src={brandProfile} alt="کیا — KIYA" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-ink-900 group-hover:text-brand-500 transition-colors">
                کیا — KIYA
              </span>
              <BadgeCheck className="w-4 h-4 text-brand-500" />
              {post.badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-500 border border-brand-200">
                  {post.badge}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <span>{product.categoryName}</span>
              <span>·</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>
          </div>
        </button>

        <span className="text-[11px] font-mono text-ink-400 bg-canvas-sunken px-2 py-1 rounded-lg">
          <bdi>{product.sku}</bdi>
        </span>
      </div>

      {/* Media Carousel (Locked 1:1 Aspect Ratio -> Zero CLS) */}
      <div
        onClick={handleMediaClick}
        className="relative aspect-square bg-canvas-sunken cursor-pointer select-none overflow-hidden group"
      >
        <img
          src={product.images[imgIdx]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
          loading="lazy"
        />

        {showBigHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart className="w-24 h-24 text-white fill-white big-heart drop-shadow-lg" />
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {discount > 0 && (
            <span className="px-2.5 py-1 bg-danger text-white text-xs font-extrabold rounded-full shadow-md">
              {formatNumber(discount)}٪ تخفیف
            </span>
          )}
          {product.stock > 0 && product.stock <= product.lowStockThreshold && (
            <span className="px-2.5 py-1 bg-amber-500 text-white text-[11px] font-bold rounded-full shadow-md">
              فقط {formatNumber(product.stock)} عدد مانده
            </span>
          )}
        </div>

        {/* Carousel Controls */}
        {product.images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImgIdx((prev) => (prev - 1 + product.images.length) % product.images.length);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-85 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              aria-label="تصویر قبلی"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImgIdx((prev) => (prev + 1) % product.images.length);
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-85 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              aria-label="تصویر بعدی"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/35 px-2.5 py-1 rounded-full">
              {product.images.map((_, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    idx === imgIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/55'
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3.5">
        {/* Social Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => toggleLikePost(post.id)}
              className="flex items-center gap-1.5 text-sm font-bold text-ink-700 hover:text-brand-500 transition-colors"
              aria-label="پسندیدن پست"
            >
              <Heart
                className={cn(
                  'w-5 h-5 transition-transform',
                  post.isLiked && 'fill-danger text-danger heart-pop'
                )}
              />
              <span>{formatNumber(post.likes)}</span>
            </button>

            <button
              onClick={() => setSelectedPostId(post.id)}
              className="flex items-center gap-1.5 text-sm font-bold text-ink-700 hover:text-brand-500 transition-colors"
              aria-label="مشاهده نظرات"
            >
              <MessageCircle className="w-5 h-5" />
              <span>{formatNumber(postComments.length)}</span>
            </button>

            <button
              onClick={handleShare}
              className="text-ink-700 hover:text-brand-500 transition-colors"
              aria-label="اشتراک‌گذاری پست"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => toggleSavePost(post.id)}
            className="text-ink-700 hover:text-brand-500 transition-colors"
            aria-label="ذخیره پست"
          >
            <Bookmark
              className={cn('w-5 h-5', post.isSaved && 'fill-brand-500 text-brand-500')}
            />
          </button>
        </div>

        {/* Title & Rating */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={() => setSelectedPostId(post.id)}
              className="text-right font-extrabold text-[16px] text-ink-900 hover:text-brand-500 transition-colors leading-snug"
            >
              {product.name}
            </button>
            <div className="flex items-center gap-1 shrink-0 bg-warning-light text-warning px-2 py-0.5 rounded-full">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="text-xs font-extrabold">{formatNumber(product.rating)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-ink-500">
            <span className="text-success font-semibold">
              {formatNumber(product.soldCount)} فروش موفق
            </span>
            <span>·</span>
            <span>موجودی انبار: {formatNumber(product.stock)} واحد</span>
            <span>·</span>
            <span>مخاطب: {product.audience}</span>
          </div>
        </div>

        {/* Progressive Disclosure L0 -> L1 -> L2 */}
        <div className="text-sm text-ink-700 leading-relaxed">
          <p className={cn(!expandedL1 && 'line-clamp-2')}>{post.caption}</p>

          {expandedL1 && (
            <div className="mt-2.5 p-3 rounded-xl bg-canvas-sunken border border-border space-y-2 text-xs text-ink-700">
              <p className="font-semibold text-ink-900">{product.shortDescription}</p>
              <ul className="space-y-1">
                {product.specs.slice(0, 3).map((s) => (
                  <li key={s.label}>
                    <span className="text-ink-500">{s.label}:</span>{' '}
                    <span className="font-semibold">{s.value}</span>
                  </li>
                ))}
              </ul>
              {product.hygieneReturnNote && (
                <div className="flex items-start gap-1.5 text-[11px] text-brand-600 bg-brand-50 p-2 rounded-lg">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{product.hygieneReturnNote}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-1.5">
            <button
              type="button"
              aria-expanded={expandedL1}
              onClick={() => setExpandedL1((v) => !v)}
              className="text-xs font-extrabold text-brand-500 hover:underline"
            >
              {expandedL1 ? 'کمتر' : 'بیشتر...'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPostId(post.id)}
              className="text-xs font-semibold text-ink-500 hover:text-brand-500 flex items-center gap-1"
            >
              <Info className="w-3.5 h-3.5" />
              <span>مشخصات کامل و جدول سایز</span>
            </button>
          </div>
        </div>

        {/* Commercial Section: Retail Mode vs Approved-Partner Wholesale Mode */}
        {isWholesaleView ? (
          <div className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-brand-600 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                {pack.label} ({formatNumber(pack.unitsPerPack)} واحدی)
              </span>
              <span className="text-[11px] font-bold text-ink-600">
                قابل تأمین: {formatNumber(maxPacks)} جین
              </span>
            </div>

            {/* Pack BOM Components */}
            <div className="flex flex-wrap gap-1.5">
              {pack.components.map((comp) => (
                <span
                  key={comp.variantLabel}
                  className="text-[11px] bg-surface px-2 py-0.5 rounded-md border border-border text-ink-700"
                >
                  {formatNumber(comp.units)}× {comp.variantLabel}
                </span>
              ))}
            </div>

            {pack.priceMode === 'FIXED' ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center bg-surface p-2.5 rounded-xl border border-border">
                  <div>
                    <p className="text-[10px] text-ink-500">واحد عمده همکار</p>
                    <p className="text-xs font-extrabold text-brand-600">
                      {formatPrice(pack.wholesaleUnitPriceToman)}
                    </p>
                  </div>
                  <div className="border-x border-border">
                    <p className="text-[10px] text-ink-500">قیمت هر جین کامل</p>
                    <p className="text-xs font-black text-ink-900">
                      {formatPrice(packTotalPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-500">تک‌فروشی سایت</p>
                    <p className="text-xs font-semibold text-ink-600">
                      {formatPrice(product.price)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-2 py-1">
                    <button
                      onClick={() => setPackCount((c) => Math.max(1, c - 1))}
                      className="w-7 h-7 rounded-lg bg-canvas-sunken flex items-center justify-center font-bold"
                      aria-label="کاهش تعداد جین"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-extrabold px-1 min-w-[52px] text-center">
                      {formatNumber(packCount)} جین
                    </span>
                    <button
                      onClick={() => setPackCount((c) => Math.min(Math.max(1, maxPacks), c + 1))}
                      className="w-7 h-7 rounded-lg bg-canvas-sunken flex items-center justify-center font-bold"
                      aria-label="افزایش تعداد جین"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    disabled={maxPacks < 1}
                    onClick={() => addToWholesaleCart(product.id, packCount)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-bold text-xs flex items-center justify-center gap-1.5 shadow-e1 disabled:opacity-50"
                  >
                    <Layers className="w-4 h-4" />
                    {maxPacks >= 1
                      ? `افزودن ${formatNumber(packCount)} جین به سبد عمده`
                      : 'موجودی کمتر از ۱ جین'}
                  </button>
                </div>
              </>
            ) : (
              /* WH10: Inquiry-only wholesale item -> never show 0 Toman */
              <div className="flex items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
                <div>
                  <p className="text-xs font-bold text-ink-900">فروش عمده استعلامی کارگاه</p>
                  <p className="text-[11px] text-ink-500">
                    قیمت تک‌فروشی مرجع: {formatPrice(product.price)}
                  </p>
                </div>
                <button
                  onClick={() => setRoute('inbox')}
                  className="px-3.5 py-2 rounded-xl bg-buy text-buy-fg text-xs font-bold"
                >
                  استعلام از پشتیبانی
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Standard Retail View — ZERO wholesale price in DOM (WH01)! */
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-500 ml-1">رنگ:</span>
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all',
                      selectedColor === color
                        ? 'border-brand-500 bg-brand-50 text-brand-600'
                        : 'border-border text-ink-600 hover:border-ink-300'
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-500 ml-1">{product.sizeLabel || 'سایز'}:</span>
                {product.sizes.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all',
                      selectedSize === sz
                        ? 'border-brand-500 bg-brand-50 text-brand-600'
                        : 'border-border text-ink-600 hover:border-ink-300'
                    )}
                  >
                    <bdi className="font-sans">{sz}</bdi>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 bg-canvas-sunken rounded-2xl border border-border-subtle">
              <div>
                {product.comparePrice && (
                  <span className="text-xs text-ink-400 line-through block">
                    {formatPrice(product.comparePrice)}
                  </span>
                )}
                <span className="text-lg font-black text-ink-900">
                  {formatPrice(product.price)}
                </span>
              </div>

              <button
                onClick={() =>
                  product.stock > 0
                    ? addToRetailCart(product.id, selectedColor, selectedSize, 1)
                    : showToast('درخواست اطلاع از شارژ موجودی برای شما ثبت شد.', 'info')
                }
                className={cn(
                  'px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95',
                  product.stock > 0
                    ? 'bg-buy text-buy-fg hover:bg-buy-hover shadow-e1'
                    : 'bg-surface border border-border text-ink-700'
                )}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{product.stock > 0 ? 'افزودن به سبد' : 'اطلاع از موجودی'}</span>
              </button>
            </div>

            {!isApprovedPartner && (
              <div className="flex items-center justify-between text-[11px] text-ink-500 px-1">
                <span>خرید عمده جینی (حداقل ۱ جین): برای مشاهده قیمت عمده حساب همکار نیاز است.</span>
                <button
                  onClick={() => setRoute('wholesale')}
                  className="text-brand-500 font-bold hover:underline shrink-0 mr-2"
                >
                  درخواست همکاری
                </button>
              </div>
            )}
          </>
        )}

        {/* Inline Comments Preview + Quick Comment Box */}
        <div className="pt-2.5 border-t border-border space-y-2">
          {postComments.slice(0, 2).map((cm) => (
            <div key={cm.id} className="text-xs leading-relaxed">
              <span className="font-bold text-ink-900 ml-1.5">{cm.author.name}</span>
              {cm.author.isVerifiedBuyer && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-success bg-success-light px-1.5 py-0.5 rounded ml-1.5">
                  خرید تأییدشده
                </span>
              )}
              <span className="text-ink-700">{cm.text}</span>
            </div>
          ))}

          {postComments.length > 0 && (
            <button
              onClick={() => setSelectedPostId(post.id)}
              className="text-xs font-semibold text-ink-500 hover:text-brand-500"
            >
              مشاهده همه {formatNumber(postComments.length)} دیدگاه و پاسخ‌های فروشگاه...
            </button>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!quickComment.trim()) return;
              addComment(post.id, quickComment);
              setQuickComment('');
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              type="text"
              value={quickComment}
              onChange={(e) => setQuickComment(e.target.value)}
              placeholder="پرسش یا دیدگاه درباره این کالا بنویسید..."
              className="flex-1 h-9 px-3 rounded-xl bg-canvas-sunken text-xs text-ink-900 placeholder:text-ink-400 border border-transparent focus:border-brand-500 focus:bg-surface outline-none"
            />
            <button
              type="submit"
              disabled={!quickComment.trim()}
              className="h-9 px-3 rounded-xl bg-brand-50 text-brand-600 text-xs font-bold disabled:opacity-40 flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5 -scale-x-100" />
              <span>ارسال</span>
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
