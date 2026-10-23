import { useState } from 'react';
import {
  Package,
  Wallet,
  Sparkles,
  Bookmark,
  CheckCircle2,
  FileText,
  Plus,
  Gift,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import type { Order, OrderStatus } from '../../types';
import { cn } from '../../utils/cn';
import {
  formatPrice,
  formatNumber,
  formatJalaliDate,
  formatJalaliDateTime,
} from '../../utils/format';

const TIMELINE_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'ثبت سفارش' },
  { key: 'confirmed', label: 'تأیید پرداخت' },
  { key: 'preparing', label: 'آماده‌سازی انبار' },
  { key: 'shipped', label: 'تحویل به پست/پیک' },
  { key: 'delivered', label: 'تحویل به خریدار' },
];

const WHEEL_PRIZES = [
  { label: '۵۰٬۰۰۰ تومان اعتبار تبلیغاتی خرید', amount: 50000, odds: '۳۰٪' },
  { label: '۱۰۰٬۰۰۰ تومان اعتبار تبلیغاتی خرید', amount: 100000, odds: '۱۵٪' },
  { label: 'ارسال رایگان سفارش بعدی (معادل ۹۵٬۰۰۰ تومان)', amount: 95000, odds: '۲۵٪' },
  { label: '۳۰٬۰۰۰ تومان اعتبار هدیه خوش‌شانسی', amount: 30000, odds: '۳۰٪' },
];

export function AccountOrdersView() {
  const {
    customer,
    orders,
    walletEntries,
    walletBalance,
    walletPromoBalance,
    topUpWalletDemo,
    grantWheelReward,
    hasSpunWheelToday,
    posts,
    products,
    setSelectedPostId,
  } = useStore();

  const [tab, setTab] = useState<'orders' | 'wallet' | 'wheel' | 'saved'>('orders');
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [spinning, setSpinning] = useState(false);

  const savedPosts = posts.filter((p) => p.isSaved);

  const handleSpin = () => {
    if (hasSpunWheelToday || spinning) return;
    setSpinning(true);
    setTimeout(() => {
      const picked = WHEEL_PRIZES[0];
      grantWheelReward(picked.label, picked.amount);
      setSpinning(false);
    }, 900);
  };

  return (
    <div className="w-full max-w-[940px] mx-auto space-y-5">
      {/* User Summary Card */}
      <div className="bg-surface rounded-3xl border border-border p-5 shadow-e1 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black text-ink-900">{customer.name}</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            موبایل: <bdi>{customer.phone}</bdi> · موجودی کل کیف پول:{' '}
            <strong className="text-brand-600">{formatPrice(walletBalance)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-canvas-sunken p-1 rounded-2xl border border-border text-xs font-extrabold">
          {[
            { id: 'orders' as const, label: 'سفارش‌ها و تایم‌لاین', icon: Package },
            { id: 'wallet' as const, label: 'کیف پول (Ledger)', icon: Wallet },
            { id: 'wheel' as const, label: 'گردونه تبلیغاتی', icon: Gift },
            { id: 'saved' as const, label: 'ذخیره‌شده‌ها', icon: Bookmark },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all',
                  tab === t.id ? 'bg-buy text-buy-fg shadow-e1' : 'text-ink-600 hover:text-ink-900'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Orders & 5-Step Visual Timeline */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {orders.map((ord) => {
            const currentIdx = TIMELINE_STEPS.findIndex((s) => s.key === ord.status);
            return (
              <div
                key={ord.id}
                className="bg-surface rounded-3xl border border-border p-5 shadow-e1 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-brand-50 text-brand-600">
                      <bdi>{ord.code}</bdi>
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full',
                        ord.salesMode === 'WHOLESALE'
                          ? 'bg-gold-400/25 text-gold-text'
                          : 'bg-canvas-sunken text-ink-700'
                      )}
                    >
                      {ord.salesMode === 'WHOLESALE' ? 'فاکتور عمده جینی همکار' : 'خرید تک‌فروشی'}
                    </span>
                    <span className="text-xs text-ink-500">
                      {formatJalaliDate(ord.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-ink-900">
                      {formatPrice(ord.totalToman)}
                    </span>
                    <button
                      onClick={() => setInvoiceOrder(ord)}
                      className="px-3 py-1.5 rounded-xl bg-canvas-sunken hover:bg-brand-50 border border-border text-xs font-bold flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5 text-brand-500" />
                      <span>فاکتور رسمی</span>
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                {ord.status === 'cancelled' ? (
                  <div className="p-3 rounded-xl bg-danger-light text-danger text-xs font-bold">
                    این سفارش لغو شده و موجودی رزروشده به انبار بازگشته است.
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {TIMELINE_STEPS.map((st, idx) => {
                      const done = idx <= currentIdx;
                      return (
                        <div key={st.key} className="flex flex-col items-center text-center gap-1.5">
                          <div
                            className={cn(
                              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold border-2',
                              done
                                ? 'bg-success border-success text-white'
                                : 'bg-canvas-sunken border-border text-ink-400'
                            )}
                          >
                            {done ? <CheckCircle2 className="w-4 h-4" /> : formatNumber(idx + 1)}
                          </div>
                          <span
                            className={cn(
                              'text-[10px] font-bold leading-tight',
                              done ? 'text-ink-900' : 'text-ink-400'
                            )}
                          >
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Order Lines */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                  {ord.lines.map((line, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-2xl bg-canvas-sunken flex items-center gap-3"
                    >
                      <img
                        src={line.image}
                        alt={line.productName}
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-ink-900 truncate">
                          {line.productName}
                        </p>
                        <p className="text-[11px] text-ink-500 truncate">{line.variantSummary}</p>
                        <p className="text-[11px] font-extrabold text-brand-600">
                          {formatNumber(line.quantityUnits)} واحد · {formatPrice(line.lineTotalToman)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Immutable Wallet Ledger (F11) */}
      {tab === 'wallet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface rounded-2xl border border-border p-4 space-y-1">
              <span className="text-xs text-ink-500">موجودی کل قابل خرید</span>
              <p className="text-xl font-black text-brand-600">{formatPrice(walletBalance)}</p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-4 space-y-1">
              <span className="text-xs text-ink-500">سهم اعتبار تبلیغاتی (غیرقابل برداشت نقدی)</span>
              <p className="text-xl font-black text-gold-text">{formatPrice(walletPromoBalance)}</p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col justify-between gap-2">
              <span className="text-xs text-ink-600 font-semibold">شارژ سریع آزمایشی کیف پول:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => topUpWalletDemo(500000)}
                  className="flex-1 py-2 rounded-xl bg-buy text-buy-fg text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ۵۰۰ هزار
                </button>
                <button
                  onClick={() => topUpWalletDemo(2000000)}
                  className="flex-1 py-2 rounded-xl bg-brand-50 text-brand-600 border border-brand-200 text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />۲ میلیون
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-extrabold text-sm text-ink-900">
              دفتر کل تغییرناپذیر تراکنش‌های کیف پول (Wallet Ledger)
            </div>
            <div className="divide-y divide-border">
              {walletEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-ink-900">{entry.title}</p>
                    <p className="text-[11px] text-ink-500">
                      شناسه مرجع: <bdi>{entry.refCode}</bdi> ·{' '}
                      {formatJalaliDateTime(entry.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-black text-sm shrink-0',
                      entry.amountToman >= 0 ? 'text-success' : 'text-danger'
                    )}
                  >
                    {entry.amountToman >= 0 ? '+' : '−'}{' '}
                    {formatPrice(Math.abs(entry.amountToman))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Promotional Wheel with Legal Transparency (F13) */}
      {tab === 'wheel' && (
        <div className="bg-surface rounded-3xl border border-border p-6 shadow-e1 space-y-4">
          <div className="p-3.5 rounded-2xl bg-warning-light border border-warning/30 text-xs text-ink-900 flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold">پیش‌نمایش ماژول گردونه تبلیغاتی (مشروط به تأیید حقوقی در محیط تولید):</p>
              <p className="mt-0.5 text-ink-700">
                بدون شرط خرید پولی · یک بار در هر ۲۴ ساعت بر مبنای زمان سرور · جوایز صرفاً اعتبار تخفیفی غیرقابل برداشت نقدی در کیف پول هستند.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center pt-2">
            <div className="flex flex-col items-center text-center space-y-4 p-6 rounded-3xl bg-gradient-to-br from-[#482780] to-[#211A2B] text-white">
              <Sparkles className={cn('w-14 h-14 text-gold-400', spinning && 'animate-spin')} />
              <h2 className="text-lg font-black">گردونه شانس روزانه کیا</h2>
              <p className="text-xs text-white/80">
                نتیجه قرعه‌کشی در سرور اصلی با تولیدکننده تصادفی امن (CSPRNG) و سقف بودجه کمپین تعیین می‌شود.
              </p>
              <button
                disabled={hasSpunWheelToday || spinning}
                onClick={handleSpin}
                className="px-6 py-3 rounded-2xl bg-gold-500 text-[#211A2B] font-black text-sm disabled:opacity-50"
              >
                {spinning
                  ? 'در حال چرخش...'
                  : hasSpunWheelToday
                    ? 'سهمیه ۲۴ ساعت امروز استفاده شد ✓'
                    : 'چرخش رایگان امروز'}
              </button>
            </div>

            <div className="space-y-2.5">
              <h3 className="font-extrabold text-sm text-ink-900">جدول شفاف جوایز و احتمال‌ها:</h3>
              {WHEEL_PRIZES.map((pz) => (
                <div
                  key={pz.label}
                  className="p-3 rounded-xl bg-canvas-sunken border border-border flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-ink-800">{pz.label}</span>
                  <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-600 font-extrabold">
                    شانس: {pz.odds}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Saved Posts */}
      {tab === 'saved' && (
        <div>
          {savedPosts.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-10 text-center text-xs text-ink-500">
              هنوز پستی را نشان‌گذاری نکرده‌اید. روی آیکون نشانک در پایین پست‌ها بزنید.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {savedPosts.map((po) => {
                const prod = products.find((p) => p.id === po.productId);
                if (!prod) return null;
                return (
                  <button
                    key={po.id}
                    onClick={() => setSelectedPostId(po.id)}
                    className="bg-surface rounded-2xl border border-border overflow-hidden text-right group"
                  >
                    <div className="aspect-square bg-canvas-sunken overflow-hidden">
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-extrabold text-ink-900 truncate">{prod.name}</p>
                      <p className="text-xs font-black text-brand-600 mt-0.5">
                        {formatPrice(prod.price)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Printable / Snapshot Invoice Modal */}
      {invoiceOrder && (
        <div
          onClick={(e) => e.target === e.currentTarget && setInvoiceOrder(null)}
          className="fixed inset-0 z-[130] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-surface w-full max-w-[560px] rounded-3xl border border-border p-6 shadow-e4 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-black text-ink-900">
                  صورت‌حساب الکترونیکی کیا — KIYA
                </h3>
                <p className="text-ink-500 mt-0.5">
                  شماره سفارش: <bdi>{invoiceOrder.code}</bdi> · تاریخ:{' '}
                  {formatJalaliDate(invoiceOrder.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setInvoiceOrder(null)}
                className="w-8 h-8 rounded-xl bg-canvas-sunken flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-canvas-sunken">
              <p>
                <strong>خریدار:</strong> {invoiceOrder.customerName}
              </p>
              <p>
                <strong>نوع فروش:</strong>{' '}
                {invoiceOrder.salesMode === 'WHOLESALE' ? 'عمده جینی همکار' : 'تک‌فروشی'}
              </p>
              <p className="col-span-2">
                <strong>نشانی تحویل:</strong> {invoiceOrder.city} — {invoiceOrder.address}
              </p>
            </div>

            <div className="divide-y divide-border border rounded-xl border-border">
              {invoiceOrder.lines.map((ln, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink-900">{ln.productName}</p>
                    <p className="text-[11px] text-ink-500">{ln.variantSummary}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="font-bold">{formatPrice(ln.lineTotalToman)}</p>
                    <p className="text-[10px] text-ink-400">
                      واحد: {formatPrice(ln.unitPriceToman)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1 pt-2 border-t border-border">
              <div className="flex justify-between">
                <span>هزینه ارسال:</span>
                <span>
                  {invoiceOrder.shippingCostToman === 0
                    ? 'رایگان'
                    : formatPrice(invoiceOrder.shippingCostToman)}
                </span>
              </div>
              {invoiceOrder.discountToman > 0 && (
                <div className="flex justify-between text-success font-bold">
                  <span>تخفیف:</span>
                  <span>− {formatPrice(invoiceOrder.discountToman)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-ink-900 pt-1">
                <span>مبلغ کل فاکتور (Snapshot قطعی):</span>
                <span className="text-brand-600">{formatPrice(invoiceOrder.totalToman)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
