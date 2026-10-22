import { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  Lock,
  ShieldCheck,
  Building2,
  Send,
  AlertCircle,
  Minus,
  Plus,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatPrice, formatNumber } from '../../utils/format';

export function WholesaleView() {
  const {
    customer,
    isApprovedPartner,
    setSalesMode,
    products,
    addToWholesaleCart,
    submitPartnerApplication,
    switchDemoPersona,
    setRoute,
  } = useStore();

  const [packCounts, setPackCounts] = useState<Record<string, number>>({});
  const [applicantName, setApplicantName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [businessName, setBusinessName] = useState(customer.businessName || '');
  const [city, setCity] = useState('تهران');
  const [channelOrPage, setChannelOrPage] = useState('');
  const [note, setNote] = useState('');

  const getPackQty = (id: string) => packCounts[id] || 1;
  const setPackQty = (id: string, val: number) =>
    setPackCounts((prev) => ({ ...prev, [id]: Math.max(1, Math.round(val)) }));

  const handleSubmitApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !phone.trim()) return;
    submitPartnerApplication({
      applicantName,
      phone,
      businessName,
      city,
      channelOrPage,
      note,
    });
  };

  return (
    <div className="w-full max-w-[960px] mx-auto space-y-5">
      {/* Policy Hero Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#482780] via-[#381C68] to-[#211A2B] text-white p-6 shadow-e3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gold-500 text-[#211A2B] flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black">
                سامانه عمده‌فروشی جینی و حساب همکاران کیا
              </h1>
              <p className="text-xs text-white/80">
                تأمین مستقیم فروشگاه‌ها و پیج‌های سراسر کشور از انبار مرکزی کیا
              </p>
            </div>
          </div>

          <span className="px-3 py-1.5 rounded-xl bg-white/15 text-xs font-extrabold border border-white/20">
            وضعیت حساب شما:{' '}
            {customer.partnerStatus === 'APPROVED'
              ? 'همکار تأییدشده ✓'
              : customer.partnerStatus === 'PENDING'
                ? 'در انتظار بررسی پشتیبانی'
                : customer.partnerStatus === 'SUSPENDED'
                  ? 'تعلیق‌شده'
                  : 'مشتری عادی'}
          </span>
        </div>

        {/* Owner Confirmed Wholesale Rules */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
            <p className="font-extrabold text-gold-300">حداقل خرید: فقط ۱ جین</p>
            <p className="text-white/80 mt-0.5">
              گام افزایش ۱ جین کامل؛ بدون تحمیل حداقل مبلغ اضافه یا شرط دو و سه جین.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
            <p className="font-extrabold text-gold-300">محرمانگی نرخ همکار</p>
            <p className="text-white/80 mt-0.5">
              قیمت عمده هرگز در نمای عمومی، سئو یا کانال عمومی افشا نمی‌شود تا حاشیه سود همکار حفظ گردد.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
            <p className="font-extrabold text-gold-300">ترکیب شفاف هر جین (BOM)</p>
            <p className="text-white/80 mt-0.5">
              تعداد واحد داخل هر بسته (۴، ۶، ۸، ۱۰ یا ۱۲ تایی) دقیقاً بر اساس مشخصات همان کالا محاسبه می‌شود.
            </p>
          </div>
        </div>
      </div>

      {/* Approved Partner View -> Full Wholesale Jini Catalog */}
      {isApprovedPartner ? (
        <div className="space-y-4">
          <div className="bg-success-light border border-success/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm font-bold text-ink-900">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <span>
                خوش آمدید {customer.businessName || customer.name}! لیست قیمت اختصاصی همکاران و خرید جینی برای شما فعال است.
              </span>
            </div>
            <button
              onClick={() => setSalesMode('WHOLESALE')}
              className="px-4 py-2 rounded-xl bg-buy text-buy-fg text-xs font-extrabold"
            >
              تغییر حالت کل سایت به عمده
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((product) => {
              const pack = product.packDefinition;
              const maxPacks = Math.floor(product.stock / pack.unitsPerPack);
              const qty = getPackQty(product.id);
              const packPrice = pack.wholesaleUnitPriceToman * pack.unitsPerPack;

              return (
                <div
                  key={product.id}
                  className="bg-surface rounded-2xl border border-border p-4 shadow-e1 flex flex-col justify-between space-y-3"
                >
                  <div className="flex gap-3">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-ink-400">
                        <bdi>{product.sku}</bdi>
                      </span>
                      <h3 className="font-extrabold text-sm text-ink-900 leading-snug">
                        {product.name}
                      </h3>
                      <p className="text-xs font-bold text-brand-600 mt-1">
                        {pack.label} ({formatNumber(pack.unitsPerPack)} واحدی)
                      </p>
                    </div>
                  </div>

                  {/* BOM Components */}
                  <div className="flex flex-wrap gap-1.5">
                    {pack.components.map((comp) => (
                      <span
                        key={comp.variantLabel}
                        className="text-[11px] bg-canvas-sunken px-2 py-0.5 rounded-md border border-border text-ink-700"
                      >
                        {formatNumber(comp.units)}× {comp.variantLabel}
                      </span>
                    ))}
                  </div>

                  {pack.priceMode === 'FIXED' ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center bg-canvas-sunken p-2.5 rounded-xl">
                        <div>
                          <span className="text-[10px] text-ink-500 block">واحد عمده</span>
                          <span className="text-xs font-extrabold text-brand-600">
                            {formatPrice(pack.wholesaleUnitPriceToman)}
                          </span>
                        </div>
                        <div className="border-x border-border">
                          <span className="text-[10px] text-ink-500 block">قیمت ۱ جین</span>
                          <span className="text-xs font-black text-ink-900">
                            {formatPrice(packPrice)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-ink-500 block">تکی سایت</span>
                          <span className="text-xs font-semibold text-ink-600">
                            {formatPrice(product.price)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5 bg-canvas-sunken rounded-xl p-1 border border-border">
                          <button
                            onClick={() => setPackQty(product.id, qty - 1)}
                            className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-extrabold px-2">
                            {formatNumber(qty)} جین
                          </span>
                          <button
                            onClick={() =>
                              setPackQty(product.id, Math.min(Math.max(1, maxPacks), qty + 1))
                            }
                            className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          disabled={maxPacks < 1}
                          onClick={() => addToWholesaleCart(product.id, qty)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover text-xs font-extrabold disabled:opacity-50"
                        >
                          {maxPacks >= 1
                            ? `افزودن (${formatNumber(maxPacks)} جین موجود)`
                            : 'موجودی کمتر از ۱ جین'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between bg-canvas-sunken p-3 rounded-xl text-xs">
                      <span className="text-ink-700 font-semibold">
                        نرخ عمده این مدل به صورت استعلام روز است (تکی: {formatPrice(product.price)})
                      </span>
                      <button
                        onClick={() => setRoute('inbox')}
                        className="px-3 py-1.5 rounded-lg bg-buy text-buy-fg font-bold shrink-0"
                      >
                        استعلام
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Unapproved / Pending Partner View — Strictly ZERO Wholesale Price Leak (WH01)! */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Application Form or Pending Status */}
          <div className="lg:col-span-7 bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-4">
            {customer.partnerStatus === 'PENDING' ? (
              <div className="space-y-3 py-4">
                <div className="w-12 h-12 rounded-2xl bg-warning-light text-warning flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <h2 className="text-base font-extrabold text-ink-900">
                  پرونده همکاری شما در صف بررسی واحد پشتیبانی است
                </h2>
                <p className="text-xs text-ink-600 leading-relaxed">
                  درخواست همکاری شما با نام تجاری <strong>{customer.businessName || 'فروشگاه همکار'}</strong> ثبت شده است. به محض تأیید توسط کارشناس دارای مجوز <bdi>partner:approve</bdi> در پنل مدیریت، قیمت‌های عمده جینی برایتان باز خواهد شد.
                </p>
                <div className="p-3 rounded-xl bg-brand-50 border border-brand-200 text-xs text-ink-800 flex items-center justify-between gap-2">
                  <span>برای تست فوری در این پیش‌نمایش، می‌توانید وارد پنل مدیریت شوید و پرونده خود را تأیید کنید یا دکمه مقابل را بزنید:</span>
                  <button
                    onClick={() => switchDemoPersona('approved')}
                    className="px-3 py-1.5 rounded-lg bg-buy text-buy-fg font-bold shrink-0"
                  >
                    تست نمای همکار تأییدشده
                  </button>
                </div>
              </div>
            ) : customer.partnerStatus === 'SUSPENDED' ? (
              <div className="space-y-3 py-4">
                <AlertCircle className="w-10 h-10 text-danger" />
                <h2 className="text-base font-extrabold text-ink-900">
                  دسترسی همکاری عمده شما موقتاً تعلیق شده است
                </h2>
                <p className="text-xs text-ink-600">
                  سفارش‌های تسویه‌شده قبلی شما در تاریخچه سفارش‌ها محفوظ است. جهت بررسی مجدد با واحد امور همکاران در دایرکت مکاتبه فرمایید.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-brand-500" />
                  <h2 className="font-extrabold text-base text-ink-900">
                    ثبت درخواست حساب همکار (خرید عمده جینی)
                  </h2>
                </div>
                <p className="text-xs text-ink-600 leading-relaxed">
                  همکار گرامی، برای حفظ حاشیه سود فروشندگان، قیمت‌های عمده تنها پس از تأیید هویت صنفی نمایش داده می‌شوند. فرم زیر را تکمیل کنید تا در صف بررسی پشتیبانی قرار گیرد:
                </p>

                <form onSubmit={handleSubmitApp} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-ink-700 block mb-1">
                        <span className="text-danger ml-1">*</span>نام و نام خانوادگی
                      </label>
                      <input
                        required
                        type="text"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-ink-700 block mb-1">
                        <span className="text-danger ml-1">*</span>شماره موبایل تأییدشده
                      </label>
                      <input
                        required
                        type="tel"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border font-mono text-left outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-ink-700 block mb-1">
                        <span className="text-danger ml-1">*</span>نام فروشگاه / گالری / پیج
                      </label>
                      <input
                        required
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="مثلاً: گالری چرم آفتاب"
                        className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-ink-700 block mb-1">شهر محل فعالیت</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-ink-700 block mb-1">
                      آدرس پیج اینستاگرام، کانال یا نشانی مغازه
                    </label>
                    <input
                      type="text"
                      value={channelOrPage}
                      onChange={(e) => setChannelOrPage(e.target.value)}
                      placeholder="@shop_example یا آدرس پاساژ..."
                      className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-ink-700 block mb-1">
                      دسته‌های مورد نیاز و توضیح کوتاه همکاری
                    </label>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="مثلاً: خرید جینی هفتگی کیف پول، کمربند و لباس زیر..."
                      className="w-full p-3 rounded-xl bg-canvas-sunken border border-border outline-none focus:border-brand-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-extrabold text-sm flex items-center justify-center gap-2 shadow-e1"
                  >
                    <Send className="w-4 h-4 -scale-x-100" />
                    <span>ارسال درخواست به واحد امور همکاران</span>
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Public Pack Structure Preview (NO Wholesale Prices!) */}
          <div className="lg:col-span-5 bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand-500" />
              <h3 className="font-extrabold text-sm text-ink-900">
                پیش‌نمایش ساختار جین کالاها (قیمت عمده قفل است)
              </h3>
            </div>
            <p className="text-xs text-ink-500">
              مشتریان عادی فقط قیمت تکی را می‌بینند؛ ترکیب بسته‌بندی عمده هر محصول به شکل زیر تعریف شده است:
            </p>
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {products.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-canvas-sunken border border-border flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-ink-500">
                      {p.packDefinition.label} ({formatNumber(p.packDefinition.unitsPerPack)} واحدی) · تکی:{' '}
                      {formatPrice(p.price)}
                    </p>
                  </div>
                  <button
                    onClick={() => setRoute('inbox')}
                    className="px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-[11px] font-bold shrink-0"
                  >
                    پیام به پشتیبانی
                  </button>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-border flex items-center gap-2 text-[11px] text-ink-500">
              <ShieldCheck className="w-4 h-4 text-success shrink-0" />
              <span>همکار تأییدشده دسترسی پنل مدیریت ندارد؛ صرفاً ویترین عمده را می‌بیند.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
