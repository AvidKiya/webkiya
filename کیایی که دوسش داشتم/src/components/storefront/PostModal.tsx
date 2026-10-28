import { useState, useEffect } from 'react';
import {
  X,
  Heart,
  Bookmark,
  Star,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Send,
  Truck,
  RotateCcw,
  ShieldCheck,
  Layers,
  CornerDownLeft,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { brandProfile } from '../shared/Logo';
import type { QuickReaction } from '../../types';
import { cn } from '../../utils/cn';
import {
  formatPrice,
  formatNumber,
  formatRelativeTime,
  discountPercent,
} from '../../utils/format';

const QUICK_REACTIONS: QuickReaction[] = ['♥', '👍', '🔥', '❓'];

export function PostModal() {
  const {
    selectedPostId,
    setSelectedPostId,
    posts,
    products,
    comments,
    salesMode,
    isApprovedPartner,
    toggleLikePost,
    toggleSavePost,
    addToRetailCart,
    addToWholesaleCart,
    addComment,
    toggleCommentReaction,
    setRoute,
  } = useStore();

  const post = posts.find((p) => p.id === selectedPostId);
  const product = post ? products.find((pr) => pr.id === post.productId) : null;

  const [imgIdx, setImgIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [packCount, setPackCount] = useState(1);
  const [activeTab, setActiveTab] = useState<'specs' | 'size' | 'hygiene' | 'faq'>('specs');
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; authorName: string } | null>(null);

  useEffect(() => {
    if (product) {
      setImgIdx(0);
      setSelectedColor(product.colors[0]);
      setSelectedSize(product.sizes[0]);
      setPackCount(1);
    }
  }, [product]);

  useEffect(() => {
    if (!post) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPostId(null);
    };
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [post, setSelectedPostId]);

  if (!post || !product) return null;

  const postComments = comments.filter((c) => c.postId === post.id);
  const discount = discountPercent(product.price, product.comparePrice);
  const isWholesaleView = salesMode === 'WHOLESALE' && isApprovedPartner;
  const pack = product.packDefinition;
  const maxPacks = Math.floor(product.stock / pack.unitsPerPack);

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(post.id, commentText, replyTarget?.id);
    setCommentText('');
    setReplyTarget(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      onClick={(e) => e.target === e.currentTarget && setSelectedPostId(null)}
      className="fixed inset-0 z-[110] bg-[#141018]/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <div className="bg-surface w-full max-w-[1120px] h-[94vh] md:h-[88vh] rounded-t-3xl md:rounded-3xl shadow-e4 overflow-hidden flex flex-col md:flex-row modal-in">
        {/* Media Column (Right side in RTL desktop) */}
        <div className="md:w-[54%] bg-[#141018] relative flex flex-col items-center justify-center min-h-[270px] shrink-0">
          <img
            src={product.images[imgIdx]}
            alt={product.name}
            className="w-full h-full max-h-[42vh] md:max-h-full object-contain"
          />

          {product.images.length > 1 && (
            <>
              <button
                onClick={() =>
                  setImgIdx((p) => (p - 1 + product.images.length) % product.images.length)
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
                aria-label="قبلی"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setImgIdx((p) => (p + 1) % product.images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
                aria-label="بعدی"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/45 p-1.5 rounded-xl">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={cn(
                      'w-10 h-10 rounded-lg overflow-hidden border-2 transition-all',
                      i === imgIdx ? 'border-gold-400 scale-105' : 'border-transparent opacity-60'
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            onClick={() => setSelectedPostId(null)}
            className="md:hidden absolute top-3 left-3 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Details & Comments Column */}
        <div className="md:w-[46%] flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <img
                src={brandProfile}
                alt="کیا"
                className="w-9 h-9 rounded-full bg-[#482780] object-contain border border-gold-500/40"
              />
              <div>
                <div className="flex items-center gap-1 text-sm font-extrabold text-ink-900">
                  <span>کیا — KIYA</span>
                  <BadgeCheck className="w-4 h-4 text-brand-500" />
                </div>
                <span className="text-[11px] text-ink-500">
                  کد کالا: <bdi>{product.sku}</bdi>
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedPostId(null)}
              className="hidden md:flex w-8 h-8 rounded-xl items-center justify-center text-ink-500 hover:bg-canvas-sunken"
              aria-label="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink-900 leading-snug">{product.name}</h2>
              <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1 bg-warning-light text-warning px-2 py-0.5 rounded-full font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {formatNumber(product.rating)} ({formatNumber(product.reviewCount)} نظر)
                </span>
                <span>{formatNumber(product.soldCount)} خرید ثبت‌شده</span>
                <span>·</span>
                <span>موجودی: {formatNumber(product.stock)} عدد</span>
              </div>
            </div>

            <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>

            {/* Variants / Pack Selection */}
            {isWholesaleView ? (
              <div className="p-3.5 rounded-2xl bg-brand-50 border border-brand-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-brand-600">
                  <span className="flex items-center gap-1">
                    <Layers className="w-4 h-4" />
                    {pack.label}
                  </span>
                  <span>موجودی عمده: {formatNumber(maxPacks)} جین</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pack.components.map((c) => (
                    <span
                      key={c.variantLabel}
                      className="text-[11px] bg-surface px-2 py-0.5 rounded border border-border"
                    >
                      {formatNumber(c.units)}× {c.variantLabel}
                    </span>
                  ))}
                </div>
                {pack.priceMode === 'FIXED' ? (
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[11px] text-ink-500 block">
                        هر واحد عمده: {formatPrice(pack.wholesaleUnitPriceToman)}
                      </span>
                      <span className="text-base font-black text-ink-900">
                        هر جین: {formatPrice(pack.wholesaleUnitPriceToman * pack.unitsPerPack)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPackCount((c) => Math.max(1, c - 1))}
                        className="w-8 h-8 rounded-lg bg-surface border border-border font-bold"
                      >
                        −
                      </button>
                      <span className="text-xs font-extrabold px-2">
                        {formatNumber(packCount)} جین
                      </span>
                      <button
                        onClick={() => setPackCount((c) => Math.min(Math.max(1, maxPacks), c + 1))}
                        className="w-8 h-8 rounded-lg bg-surface border border-border font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-ink-600">فروش عمده این مدل به صورت استعلامی است.</span>
                    <button
                      onClick={() => {
                        setSelectedPostId(null);
                        setRoute('inbox');
                      }}
                      className="text-brand-600 font-extrabold underline"
                    >
                      پیام به واحد همکاران
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 p-3 rounded-2xl bg-canvas-sunken border border-border">
                <div>
                  <span className="text-xs font-bold text-ink-700 block mb-1.5">
                    رنگ انتخابی: {selectedColor}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {product.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-semibold border',
                          selectedColor === c
                            ? 'bg-buy text-buy-fg border-buy'
                            : 'bg-surface border-border text-ink-700'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-ink-700 block mb-1.5">
                    {product.sizeLabel || 'سایز'}: <bdi className="font-sans">{selectedSize}</bdi>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {product.sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-semibold border',
                          selectedSize === s
                            ? 'bg-buy text-buy-fg border-buy'
                            : 'bg-surface border-border text-ink-700'
                        )}
                      >
                        <bdi className="font-sans">{s}</bdi>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* L2 Full Sheet 4 Tabs: مشخصات · راهنمای سایز · ارسال و بهداشتی · پرسش‌ها */}
            <div>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-canvas-sunken border border-border text-xs font-bold">
                {[
                  { id: 'specs' as const, label: 'مشخصات' },
                  { id: 'size' as const, label: 'راهنمای سایز' },
                  { id: 'hygiene' as const, label: 'ارسال و مرجوعی' },
                  { id: 'faq' as const, label: 'پرسش‌ها' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      'py-2 rounded-lg transition-all',
                      activeTab === t.id
                        ? 'bg-surface text-brand-500 shadow-e1'
                        : 'text-ink-500 hover:text-ink-800'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 p-3.5 rounded-2xl bg-canvas-sunken/60 border border-border text-xs text-ink-700 space-y-2 leading-relaxed">
                {activeTab === 'specs' && (
                  <div className="space-y-2">
                    {product.specs.map((sp) => (
                      <div
                        key={sp.label}
                        className="flex items-start justify-between gap-3 py-1 border-b border-border/60 last:border-none"
                      >
                        <span className="text-ink-500">{sp.label}</span>
                        <span className="font-bold text-ink-900 text-left">{sp.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'size' && <p>{product.sizeGuideNote}</p>}

                {activeTab === 'hygiene' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-bold text-ink-900">
                      <Truck className="w-4 h-4 text-brand-500" />
                      <span>ارسال از انبار تهران (پیک روزانه تهران / پست پیشتاز ۲ تا ۴ روزه)</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-ink-900">
                      <RotateCcw className="w-4 h-4 text-success" />
                      <span>۷ روز ضمانت تعویض و مرجوعی طبق ضوابط کالا</span>
                    </div>
                    {product.hygieneReturnNote && (
                      <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200 text-ink-800 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                        <span>{product.hygieneReturnNote}</span>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'faq' && (
                  <div className="space-y-2.5">
                    {product.faqs.length === 0 ? (
                      <p className="text-ink-500">
                        می‌توانید پرسش خود را در بخش کامنت‌های پایین همین پنجره ثبت کنید تا پشتیبانی رسمی پاسخ دهد.
                      </p>
                    ) : (
                      product.faqs.map((f, idx) => (
                        <div key={idx}>
                          <p className="font-extrabold text-ink-900">• {f.q}</p>
                          <p className="text-ink-600 mt-0.5">{f.a}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Trust Strip */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="p-2 rounded-xl bg-canvas-sunken flex items-center justify-center gap-1.5 font-semibold text-ink-700">
                <ShieldCheck className="w-4 h-4 text-success" />
                <span>تضمین اصالت</span>
              </div>
              <div className="p-2 rounded-xl bg-canvas-sunken flex items-center justify-center gap-1.5 font-semibold text-ink-700">
                <Truck className="w-4 h-4 text-info" />
                <span>ارسال سریع</span>
              </div>
              <div className="p-2 rounded-xl bg-canvas-sunken flex items-center justify-center gap-1.5 font-semibold text-ink-700">
                <RotateCcw className="w-4 h-4 text-brand-500" />
                <span>بسته‌بندی سالم</span>
              </div>
            </div>

            {/* Comments List */}
            <div className="pt-2 border-t border-border space-y-3">
              <h3 className="font-extrabold text-sm text-ink-900">
                دیدگاه‌ها و پرسش‌های خریداران ({formatNumber(postComments.length)})
              </h3>
              {postComments.map((cm) => (
                <div key={cm.id} className="p-3 rounded-2xl bg-canvas-sunken/70 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={cm.author.avatar}
                        alt={cm.author.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-ink-900">
                            {cm.author.name}
                          </span>
                          {cm.author.isVerifiedBuyer && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success-light text-success">
                              خرید تأییدشده
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-ink-400">
                          {formatRelativeTime(cm.createdAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setReplyTarget({ id: cm.id, authorName: cm.author.name })
                      }
                      className="text-[11px] font-bold text-brand-500 hover:underline flex items-center gap-1"
                    >
                      <CornerDownLeft className="w-3 h-3" />
                      پاسخ
                    </button>
                  </div>

                  <p className="text-xs text-ink-800 leading-relaxed">{cm.text}</p>

                  {/* Quick Reactions */}
                  <div className="flex items-center gap-1.5">
                    {QUICK_REACTIONS.map((rx) => (
                      <button
                        key={rx}
                        onClick={() => toggleCommentReaction(cm.id, rx)}
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[11px] border transition-all',
                          cm.activeReaction === rx
                            ? 'bg-brand-50 border-brand-500 font-bold'
                            : 'bg-surface border-border opacity-80 hover:opacity-100'
                        )}
                      >
                        {rx}
                      </button>
                    ))}
                    <span className="text-[10px] text-ink-400 mr-1">
                      {formatNumber(cm.likes)} پسند
                    </span>
                  </div>

                  {/* 1-Level Replies */}
                  {cm.replies.length > 0 && (
                    <div className="mr-3 pr-3 border-r-2 border-brand-300 space-y-2 pt-1">
                      {cm.replies.map((rep) => (
                        <div key={rep.id} className="text-xs space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-ink-900">{rep.authorName}</span>
                            {rep.isSeller && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-buy text-buy-fg">
                                پاسخ رسمی فروشگاه
                              </span>
                            )}
                          </div>
                          <p className="text-ink-700 leading-relaxed">{rep.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sticky Comment Input + Sticky Buy Bar */}
          <div className="border-t border-border bg-surface shrink-0">
            <form
              onSubmit={handleCommentSubmit}
              className="px-4 py-2 border-b border-border flex items-center gap-2"
            >
              {replyTarget && (
                <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-1 rounded-lg font-bold flex items-center gap-1 shrink-0">
                  @{replyTarget.authorName}
                  <button type="button" onClick={() => setReplyTarget(null)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={
                  replyTarget
                    ? `پاسخ به ${replyTarget.authorName}...`
                    : 'دیدگاه یا سؤال خود را بنویسید...'
                }
                className="flex-1 text-xs bg-transparent text-ink-900 placeholder:text-ink-400 outline-none py-1.5"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="text-xs font-extrabold text-brand-500 disabled:opacity-35 flex items-center gap-1"
              >
                <Send className="w-4 h-4 -scale-x-100" />
                <span>ثبت</span>
              </button>
            </form>

            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                {!isWholesaleView && product.comparePrice && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-400 line-through">
                      {formatPrice(product.comparePrice)}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger text-white">
                      {formatNumber(discount)}٪
                    </span>
                  </div>
                )}
                <span className="text-lg font-black text-ink-900">
                  {isWholesaleView && pack.priceMode === 'FIXED'
                    ? formatPrice(pack.wholesaleUnitPriceToman * pack.unitsPerPack * packCount)
                    : formatPrice(product.price)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleLikePost(post.id)}
                  className="w-10 h-10 rounded-xl bg-canvas-sunken flex items-center justify-center text-ink-700"
                  aria-label="لایک"
                >
                  <Heart className={cn('w-5 h-5', post.isLiked && 'fill-danger text-danger')} />
                </button>
                <button
                  onClick={() => toggleSavePost(post.id)}
                  className="w-10 h-10 rounded-xl bg-canvas-sunken flex items-center justify-center text-ink-700"
                  aria-label="ذخیره"
                >
                  <Bookmark
                    className={cn('w-5 h-5', post.isSaved && 'fill-brand-500 text-brand-500')}
                  />
                </button>
                {isWholesaleView ? (
                  pack.priceMode === 'FIXED' ? (
                    <button
                      disabled={maxPacks < 1}
                      onClick={() => addToWholesaleCart(product.id, packCount)}
                      className="px-5 py-2.5 rounded-xl bg-buy text-buy-fg font-bold text-xs flex items-center gap-1.5 shadow-e1 disabled:opacity-50"
                    >
                      <Layers className="w-4 h-4" />
                      <span>افزودن {formatNumber(packCount)} جین</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedPostId(null);
                        setRoute('inbox');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-buy text-buy-fg font-bold text-xs"
                    >
                      استعلام عمده
                    </button>
                  )
                ) : (
                  <button
                    disabled={product.stock === 0}
                    onClick={() => addToRetailCart(product.id, selectedColor, selectedSize, 1)}
                    className="px-5 py-2.5 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-bold text-sm flex items-center gap-2 shadow-e1 disabled:opacity-50"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{product.stock > 0 ? 'افزودن به سبد' : 'ناموجود'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
