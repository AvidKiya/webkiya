import {
  ShoppingBag,
  TrendingUp,
  Eye,
  Star,
  AlertTriangle,
  Layers,
  Send,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { cn } from '../../utils/cn';
import { formatPrice, formatNumber } from '../../utils/format';

export function RightRail() {
  const {
    salesMode,
    setSalesMode,
    isApprovedPartner,
    retailCart,
    wholesaleCart,
    products,
    retailCount,
    retailSubtotal,
    wholesalePackTotalCount,
    wholesaleSubtotal,
    updateRetailQty,
    updateWholesalePacks,
    setCheckoutOpen,
    activities,
    setRoute,
  } = useStore();

  const isWholesale = salesMode === 'WHOLESALE' && isApprovedPartner;

  return (
    <aside className="hidden lg:flex flex-col w-[320px] shrink-0 sticky top-[104px] space-y-4">
      {/* Live Cart Cockpit */}
      <div className="bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-brand-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isWholesale ? (
              <Layers className="w-4 h-4 text-brand-500" />
            ) : (
              <ShoppingBag className="w-4 h-4 text-brand-500" />
            )}
            <span className="font-extrabold text-sm text-ink-900">
              {isWholesale ? 'سبد عمده همکار (جینی)' : 'سبد خرید تکی'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-buy text-buy-fg text-[11px] font-bold">
            {isWholesale
              ? `${formatNumber(wholesalePackTotalCount)} جین`
              : `${formatNumber(retailCount)} عدد`}
          </span>
        </div>

        {/* Cart Switch Hint if Approved Partner has items in both carts */}
        {isApprovedPartner && (
          <div className="grid grid-cols-2 p-1.5 bg-canvas-sunken border-b border-border gap-1 text-[11px] font-bold">
            <button
              onClick={() => setSalesMode('RETAIL')}
              className={cn(
                'py-1 rounded-lg transition-all',
                !isWholesale ? 'bg-surface text-ink-900 shadow-e1' : 'text-ink-500'
              )}
            >
              تکی ({formatNumber(retailCount)})
            </button>
            <button
              onClick={() => setSalesMode('WHOLESALE')}
              className={cn(
                'py-1 rounded-lg transition-all',
                isWholesale ? 'bg-buy text-buy-fg shadow-e1' : 'text-ink-500'
              )}
            >
              عمده ({formatNumber(wholesalePackTotalCount)} جین)
            </button>
          </div>
        )}

        {isWholesale ? (
          wholesaleCart.length === 0 ? (
            <div className="p-6 text-center space-y-1.5">
              <Layers className="w-8 h-8 text-ink-300 mx-auto" />
              <p className="text-xs font-bold text-ink-700">سبد عمده شما خالی است</p>
              <p className="text-[11px] text-ink-500">
                حداقل خرید همکار تنها ۱ جین کامل (بدون سقف یا حداقل مبلغ اضافه) است.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border max-h-[250px] overflow-y-auto">
                {wholesaleCart.map((item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  if (!prod) return null;
                  const packPrice =
                    prod.packDefinition.wholesaleUnitPriceToman * prod.packDefinition.unitsPerPack;
                  return (
                    <div key={item.key} className="p-3 flex gap-2.5">
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-ink-900 truncate">{prod.name}</p>
                        <p className="text-[10px] text-ink-500">
                          {prod.packDefinition.label} ({formatNumber(item.packCount * prod.packDefinition.unitsPerPack)} واحد)
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateWholesalePacks(item.key, item.packCount - 1)}
                              className="w-6 h-6 rounded bg-canvas-sunken text-xs font-bold"
                            >
                              −
                            </button>
                            <span className="text-xs font-extrabold px-1.5">
                              {formatNumber(item.packCount)} جین
                            </span>
                            <button
                              onClick={() => updateWholesalePacks(item.key, item.packCount + 1)}
                              className="w-6 h-6 rounded bg-canvas-sunken text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs font-extrabold text-brand-600">
                            {formatPrice(packPrice * item.packCount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3.5 border-t border-border space-y-2.5 bg-canvas-sunken/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-600">جمع فاکتور عمده:</span>
                  <span className="text-base font-black text-ink-900">
                    {formatPrice(wholesaleSubtotal)}
                  </span>
                </div>
                <button
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-bold text-xs shadow-e1"
                >
                  تکمیل سفارش عمده ({formatNumber(wholesalePackTotalCount)} جین)
                </button>
              </div>
            </>
          )
        ) : retailCart.length === 0 ? (
          <div className="p-6 text-center space-y-1.5">
            <ShoppingBag className="w-8 h-8 text-ink-300 mx-auto" />
            <p className="text-xs font-bold text-ink-700">سبد خرید تکی خالی است</p>
            <p className="text-[11px] text-ink-500">
              کالای دلخواه خود را مستقیماً از روی کارت پست‌های فید اضافه کنید.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border max-h-[250px] overflow-y-auto">
              {retailCart.map((item) => {
                const prod = products.find((p) => p.id === item.productId);
                if (!prod) return null;
                return (
                  <div key={item.key} className="p-3 flex gap-2.5">
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-ink-900 truncate">{prod.name}</p>
                      <p className="text-[10px] text-ink-500 truncate">
                        {item.color} · <bdi className="font-sans">{item.size}</bdi>
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateRetailQty(item.key, item.quantity - 1)}
                            className="w-6 h-6 rounded bg-canvas-sunken text-xs font-bold"
                          >
                            −
                          </button>
                          <span className="text-xs font-extrabold px-1.5">
                            {formatNumber(item.quantity)}
                          </span>
                          <button
                            onClick={() => updateRetailQty(item.key, item.quantity + 1)}
                            className="w-6 h-6 rounded bg-canvas-sunken text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-extrabold text-ink-900">
                          {formatPrice(prod.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-3.5 border-t border-border space-y-2.5 bg-canvas-sunken/40">
              {retailSubtotal < 2000000 ? (
                <div className="text-[11px] text-info bg-info-light px-2.5 py-1.5 rounded-lg">
                  {formatPrice(2000000 - retailSubtotal)} تا ارسال رایگان!
                </div>
              ) : (
                <div className="text-[11px] text-success bg-success-light px-2.5 py-1.5 rounded-lg font-bold">
                  ارسال این سفارش رایگان است!
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-600">جمع قابل پرداخت:</span>
                <span className="text-base font-black text-ink-900">
                  {formatPrice(retailSubtotal)}
                </span>
              </div>
              <button
                onClick={() => setCheckoutOpen(true)}
                className="w-full py-2.5 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-bold text-xs shadow-e1"
              >
                ادامه و ثبت سفارش
              </button>
            </div>
          </>
        )}
      </div>

      {/* Live Store Pulse */}
      <div className="bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-500" />
            <span className="font-extrabold text-xs text-ink-900">فعالیت زنده فروشگاه</span>
          </div>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
        </div>
        <div className="p-2.5 space-y-1">
          {activities.slice(0, 5).map((act) => (
            <div
              key={act.id}
              className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-canvas-sunken transition-colors"
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  act.type === 'purchase' && 'bg-success-light text-success',
                  act.type === 'view' && 'bg-info-light text-info',
                  act.type === 'low_stock' && 'bg-warning-light text-warning',
                  act.type === 'review' && 'bg-brand-50 text-brand-500'
                )}
              >
                {act.type === 'purchase' && <ShoppingBag className="w-3.5 h-3.5" />}
                {act.type === 'view' && <Eye className="w-3.5 h-3.5" />}
                {act.type === 'low_stock' && <AlertTriangle className="w-3.5 h-3.5" />}
                {act.type === 'review' && <Star className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-ink-800 leading-snug">{act.text}</p>
                <span className="text-[10px] text-ink-400">{act.timeAgo}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wholesale & Telegram Bot Promo Card */}
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
          صاحب فروشگاه یا پیج هستید؟ پس از تأیید حساب همکاری، قیمت واحد عمده و ترکیب دقیق جین هر کالا برایتان باز می‌شود.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setRoute('wholesale')}
            className="py-2 px-2.5 rounded-xl bg-gold-500 text-[#211A2B] font-extrabold text-[11px] flex items-center justify-center gap-1"
          >
            <span>پورتال همکاران</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setRoute('inbox')}
            className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] flex items-center justify-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span>ربات پیگیری</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
