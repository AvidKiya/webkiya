import { useState } from 'react';
import {
  X,
  CheckCircle2,
  MapPin,
  CreditCard,
  Smartphone,
  Wallet,
  MessageSquare,
  LayoutList,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { cn } from '../../utils/cn';
import { formatPrice, formatNumber } from '../../utils/format';

const PROVINCES: Record<string, string[]> = {
  تهران: ['تهران', 'شمیرانات', 'شهریار', 'کرج / البرز'],
  فارس: ['شیراز', 'مرودشت', 'جهرم'],
  اصفهان: ['اصفهان', 'کاشان', 'نجف‌آباد'],
  'خراسان رضوی': ['مشهد', 'نیشابور', 'سبزوار'],
  'آذربایجان شرقی': ['تبریز', 'مراغه'],
};

export function CheckoutModal() {
  const {
    checkoutOpen,
    setCheckoutOpen,
    salesMode,
    isApprovedPartner,
    customer,
    verifyCustomerOtp,
    retailSubtotal,
    wholesaleSubtotal,
    walletBalance,
    placeOrder,
    setRoute,
  } = useStore();

  const [uiStyle, setUiStyle] = useState<'accordion' | 'conversational'>('accordion');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [otpCode, setOtpCode] = useState('۴۸۲۷');
  const [otpVerified, setOtpVerified] = useState(customer.isVerifiedOtp);

  const [province, setProvince] = useState('تهران');
  const [city, setCity] = useState('تهران');
  const [address, setAddress] = useState('خیابان ولیعصر، بالاتر از میدان ونک، پلاک ۱۴، واحد ۶');
  const [postalCode, setPostalCode] = useState('1969734111');
  const [shippingId, setShippingId] = useState<'tehran_bike' | 'pishtaz' | 'pickup'>('tehran_bike');

  const [couponCode, setCouponCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'zarinpal' | 'wallet' | 'card_to_card'>(
    'zarinpal'
  );

  if (!checkoutOpen) return null;

  const isWholesale = salesMode === 'WHOLESALE' && isApprovedPartner;
  const subtotal = isWholesale ? wholesaleSubtotal : retailSubtotal;

  const shippingOptions = [
    {
      id: 'tehran_bike' as const,
      label: isWholesale ? 'باربری / تیپاکس همکاران' : 'پیک اختصاصی تهران (بازه انتخابی)',
      cost: isWholesale ? 220000 : subtotal >= 2000000 ? 0 : 120000,
    },
    {
      id: 'pishtaz' as const,
      label: 'پست پیشتاز سراسر کشور (۲ تا ۴ روز کاری)',
      cost: isWholesale ? 190000 : subtotal >= 2000000 ? 0 : 95000,
    },
    {
      id: 'pickup' as const,
      label: 'تحویل حضوری از انبار مرکزی تهران (با هماهنگی)',
      cost: 0,
    },
  ];

  const selectedShipping =
    shippingOptions.find((s) => s.id === shippingId) || shippingOptions[0];

  // Coupon KIYA10 strictly applies to RETAIL only per Doc 15!
  const discount =
    !isWholesale && couponCode.trim().toUpperCase() === 'KIYA10'
      ? Math.round(subtotal * 0.1)
      : 0;

  const finalTotal = Math.max(0, subtotal - discount) + selectedShipping.cost;

  const handleFinalize = () => {
    if (!otpVerified) {
      verifyCustomerOtp(name, phone);
      setOtpVerified(true);
    }
    const created = placeOrder({
      salesMode: isWholesale ? 'WHOLESALE' : 'RETAIL',
      customerName: name,
      customerPhone: phone,
      city: `${province} - ${city}`,
      address,
      postalCode,
      shippingMethod: selectedShipping.label,
      shippingCostToman: selectedShipping.cost,
      couponCode: isWholesale ? undefined : couponCode,
      paymentMethod,
    });
    if (created) {
      setCheckoutOpen(false);
      setRoute('account');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تسویه حساب و ثبت سفارش"
      className="fixed inset-0 z-[125] bg-[#141018]/70 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 overflow-y-auto"
    >
      <div className="bg-surface w-full max-w-[740px] max-h-[92vh] rounded-3xl shadow-e4 flex flex-col overflow-hidden modal-in">
        {/* Header + Mode Switch (Standard One-Page vs Telegram Conversational) */}
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-canvas-sunken/50">
          <div>
            <h2 className="font-extrabold text-base md:text-lg text-ink-900">
              {isWholesale ? 'تسویه فاکتور عمده جینی (همکار)' : 'تسویه حساب و ثبت سفارش'}
            </h2>
            <p className="text-[11px] text-ink-500">
              محاسبه قطعی قیمت، موجودی مشترک و رزرو اتمیک در زمان ثبت
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-surface border border-border rounded-xl p-0.5 text-xs font-bold">
              <button
                onClick={() => setUiStyle('accordion')}
                className={cn(
                  'px-2.5 py-1 rounded-lg flex items-center gap-1',
                  uiStyle === 'accordion' ? 'bg-buy text-buy-fg' : 'text-ink-500'
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                یک‌صفحه‌ای
              </button>
              <button
                onClick={() => setUiStyle('conversational')}
                className={cn(
                  'px-2.5 py-1 rounded-lg flex items-center gap-1',
                  uiStyle === 'conversational' ? 'bg-buy text-buy-fg' : 'text-ink-500'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                مکالمه‌ای
              </button>
            </div>
            <button
              onClick={() => setCheckoutOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-500 hover:bg-canvas-sunken"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {uiStyle === 'conversational' && (
            <div className="p-3.5 rounded-2xl bg-brand-50 border border-brand-200 text-xs text-ink-800 space-y-1.5">
              <p className="font-extrabold text-brand-600">
                دستیار ثبت سریع کیا (مبتنی بر موتور واحد سفارش):
              </p>
              <p>
                سلام {name}! شما در حال ثبت سفارش{' '}
                <strong>{isWholesale ? 'عمده جینی همکاران' : 'تک‌فروشی'}</strong> به مبلغ پایه{' '}
                <strong>{formatPrice(subtotal)}</strong> هستید. اطلاعات گام‌به‌گام زیر را تأیید یا ویرایش کنید:
              </p>
            </div>
          )}

          {/* Block 1: Identity & OTP */}
          <section className="rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full px-4 py-3 bg-canvas-sunken/70 flex items-center justify-between text-right"
            >
              <div className="flex items-center gap-2 font-extrabold text-sm text-ink-900">
                <Smartphone className="w-4 h-4 text-brand-500" />
                <span>۱. احراز هویت خریدار (موبایل و کد یک‌بارمصرف)</span>
              </div>
              {otpVerified && (
                <span className="text-xs font-bold text-success flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  تأییدشده
                </span>
              )}
            </button>

            {(step === 1 || uiStyle === 'conversational') && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink-700 block mb-1">
                    <span className="text-danger ml-1">*</span>نام و نام خانوادگی
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-canvas border border-border text-sm outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-700 block mb-1">
                    <span className="text-danger ml-1">*</span>شماره موبایل
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-canvas border border-border text-sm font-mono text-left outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-700 block mb-1">
                    کد تأیید پیامکی (آزمایشی)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl bg-canvas border border-border text-sm text-center font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        verifyCustomerOtp(name, phone);
                        setOtpVerified(true);
                        setStep(2);
                      }}
                      className="px-3 h-10 rounded-xl bg-buy text-buy-fg text-xs font-bold"
                    >
                      تأیید
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Block 2: Address & Shipping */}
          <section className="rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full px-4 py-3 bg-canvas-sunken/70 flex items-center justify-between text-right"
            >
              <div className="flex items-center gap-2 font-extrabold text-sm text-ink-900">
                <MapPin className="w-4 h-4 text-brand-500" />
                <span>۲. نشانی گیرنده و شیوه ارسال</span>
              </div>
              <span className="text-xs text-ink-500">
                {province} · {city}
              </span>
            </button>

            {(step === 2 || uiStyle === 'conversational') && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-ink-700 block mb-1">استان</label>
                    <select
                      value={province}
                      onChange={(e) => {
                        const nextP = e.target.value;
                        setProvince(nextP);
                        setCity(PROVINCES[nextP][0]);
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-canvas border border-border text-sm outline-none"
                    >
                      {Object.keys(PROVINCES).map((pr) => (
                        <option key={pr} value={pr}>
                          {pr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-ink-700 block mb-1">شهر</label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-canvas border border-border text-sm outline-none"
                    >
                      {PROVINCES[province].map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-ink-700 block mb-1">
                      کد پستی ۱۰ رقمی
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      maxLength={10}
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-canvas border border-border text-sm font-mono text-left outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink-700 block mb-1">
                    <span className="text-danger ml-1">*</span>نشانی دقیق پستی
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-canvas border border-border text-sm outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-ink-700 block">روش ارسال:</span>
                  {shippingOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs',
                        shippingId === opt.id
                          ? 'border-brand-500 bg-brand-50/70 font-bold'
                          : 'border-border bg-canvas'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shipping"
                          checked={shippingId === opt.id}
                          onChange={() => setShippingId(opt.id)}
                        />
                        <span>{opt.label}</span>
                      </div>
                      <span className="font-extrabold">
                        {opt.cost === 0 ? 'رایگان' : formatPrice(opt.cost)}
                      </span>
                    </label>
                  ))}
                </div>

                {uiStyle === 'accordion' && (
                  <div className="text-left">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 rounded-xl bg-buy text-buy-fg text-xs font-bold"
                    >
                      تأیید آدرس و ادامه به پرداخت
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Block 3: Payment & Coupon */}
          <section className="rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full px-4 py-3 bg-canvas-sunken/70 flex items-center justify-between text-right"
            >
              <div className="flex items-center gap-2 font-extrabold text-sm text-ink-900">
                <CreditCard className="w-4 h-4 text-brand-500" />
                <span>۳. روش پرداخت و بازبینی نهایی</span>
              </div>
              <span className="text-xs font-extrabold text-brand-600">
                {formatPrice(finalTotal)}
              </span>
            </button>

            {(step === 3 || uiStyle === 'conversational') && (
              <div className="p-4 space-y-3">
                {!isWholesale ? (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="کد تخفیف خرده‌فروشی (کد آزمایشی: KIYA10)"
                        className="w-full h-10 pr-9 pl-3 rounded-xl bg-canvas border border-border text-xs outline-none"
                      />
                    </div>
                    {discount > 0 && (
                      <span className="text-xs font-bold text-success">
                        ۱۰٪ تخفیف اعمال شد!
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-ink-500 bg-canvas-sunken px-3 py-2 rounded-xl">
                    مطابق سیاست عمده‌فروشی کیا، کوپن‌های تخفیف تک‌فروشی روی نرخ خالص همکاران اعمال نمی‌شوند.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('zarinpal')}
                    className={cn(
                      'p-3 rounded-xl border text-right space-y-1',
                      paymentMethod === 'zarinpal'
                        ? 'border-brand-500 bg-brand-50 font-bold'
                        : 'border-border bg-canvas'
                    )}
                  >
                    <p className="font-extrabold text-ink-900">درگاه زرین‌پال (شبیه‌ساز امن)</p>
                    <p className="text-[10px] text-ink-500">تأیید آنی در محیط دمو</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={cn(
                      'p-3 rounded-xl border text-right space-y-1',
                      paymentMethod === 'wallet'
                        ? 'border-brand-500 bg-brand-50 font-bold'
                        : 'border-border bg-canvas'
                    )}
                  >
                    <p className="font-extrabold text-ink-900 flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-brand-500" />
                      کیف پول کیا
                    </p>
                    <p className="text-[10px] text-ink-500">
                      موجودی: {formatPrice(walletBalance)}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card_to_card')}
                    className={cn(
                      'p-3 rounded-xl border text-right space-y-1',
                      paymentMethod === 'card_to_card'
                        ? 'border-brand-500 bg-brand-50 font-bold'
                        : 'border-border bg-canvas'
                    )}
                  >
                    <p className="font-extrabold text-ink-900">کارت‌به‌کارت با ثبت رسید</p>
                    <p className="text-[10px] text-ink-500">وضعیت اولیه: در انتظار تأیید مالی</p>
                  </button>
                </div>

                {/* Final Invoice Summary */}
                <div className="p-3.5 rounded-2xl bg-canvas-sunken space-y-1.5 text-xs">
                  <div className="flex justify-between text-ink-600">
                    <span>جمع اقلام ({isWholesale ? 'نرخ عمده جینی' : 'تک‌فروشی'}):</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-success font-bold">
                      <span>تخفیف کوپن KIYA10:</span>
                      <span>− {formatPrice(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-ink-600">
                    <span>هزینه ارسال ({selectedShipping.label}):</span>
                    <span>
                      {selectedShipping.cost === 0
                        ? 'رایگان'
                        : formatPrice(selectedShipping.cost)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border text-sm font-black text-ink-900">
                    <span>مبلغ نهایی قابل پرداخت:</span>
                    <span className="text-brand-600">{formatPrice(finalTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Sticky Confirm Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-surface flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
            <ShieldCheck className="w-4 h-4 text-success shrink-0" />
            <span>قفل رزرو ۱۰ دقیقه‌ای موجودی و کلید یکتای جلوگیری از تکرار تراکنش</span>
          </div>
          <button
            type="button"
            onClick={handleFinalize}
            className="px-6 py-3 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-extrabold text-sm shadow-e2 shrink-0"
          >
            ثبت قطعی سفارش ({formatNumber(Math.round(finalTotal / 1000))} هزار تومان)
          </button>
        </div>
      </div>
    </div>
  );
}
