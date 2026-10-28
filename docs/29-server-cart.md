# گزارش۲۹ — سبد سروری و محاسبهٔ قیمت جاری

2026-10-22 · نسخه0.8.0 · شاخه arena/f6a09f64-webkiya. مرجع کل محدوده: [نقشه۲۶](26-delivery-map.md) و `/progress`. این مرحله رزرو/checkout نیست و FULL را کامل اعلام نمی‌کند.

## مسیر استفاده

مشتری وارد حساب شود؛ در demo ورود مصنوعی مشخص است و در live مالکیت واقعی شماره لازم است (OTP هنوز متصل نیست). کالای واقعی منتشرشده از فید/پست ← «افزودن به سبد سروری»؛ همکار APPROVED دارای قیمت خصوصی معتبر از `/wholesale` ← «افزودن یک جین به سبد سروری». در `/basket` نوع سبد، تعداد، حذف با صفر، تازه‌سازی و محاسبهٔ جاری وجود دارد. نمونه‌ها به این API راه ندارند؛ سبد محلی `/cart` فقط رابط نمونه باقی می‌ماند. اطلاعات واقعی کالا/قیمت/stock یا حساب دیگری برای کسب‌وکار ساخته نشد.

## قرارداد و کنترل‌ها

- `GET /api/cart?mode=RETAIL|WHOLESALE` فقط قصد خرید متعلق به session را برمی‌گرداند؛ قیمت ذخیره نمی‌شود. همکار منقضی می‌تواند اقلام سابق خود را ببیند/حذف کند ولی محاسبهٔ خصوصی مجاز نیست.
- `POST /api/cart` شامل mode/itemId/quantity/requestId؛ افزودن همان SKU/pack تعداد را جمع می‌کند. `PATCH` شامل mode/lineId/quantity/version/requestId؛ مقدار صفر حذف است. strict schema اجازهٔ قیمت یا userId ورودی نمی‌دهد. سقف۵۰ردیف و۱۰۰۰انتخاب حد ایمنی است، نه حداقل خرید عمده.
- UUID + digest شامل user/mode/kind/body، advisory lock و CartOperation immutable جلوی اجرای دوبارهٔ retry را می‌گیرد. کلید مشترک با payload متفاوت409 است. SET با نسخهٔ کهنه409؛ ردیف حساب دیگر404. audit و mutation در یک transaction‌اند؛ outbox یا اعلان بیرونی ادعا نمی‌شود.
- `POST /api/cart/quote` فقط mode/version می‌گیرد. lock سبد، محصولات مرتب، همکاری و SKUهای مرتب، نسخهٔ جاری محصول/جین/قیمت و اعتبار تخصیص همان همکار بررسی می‌شود. قیمت استعلامی یا ناموجود جایگزین صفر نمی‌شود. مقدار موردنیاز SKUهای مشترک چند جین جمع می‌شود، سپس stock-reserved بررسی می‌شود.
- پول رشتهٔ تومان است؛ ضرب/جمع BigInt با سقف۱۴رقم، واحد انتخاب خرده یک SKU و عمده یک جین با BOM واقعی است؛ عدد۱۲ یا کف مبلغ تحمیل نشده است. نرخ واحد عمده فعلاً بین اجزای جین یکسان است.
- quote نسخه‌های محصول/جین/offer و اجزا را برای نمایش برمی‌گرداند؛ snapshot پایدار، امضا یا مجوز ثبت سفارش نیست. اعتبار نمایش حداکثر۱۲۰ثانیه و محدود به expiry همکار/offer است؛ پس از انقضا، تغییر سبد/نوع سبد یا focus دوباره محاسبه لازم است. کنترل سمت سرور در درخواست بعدی انجام می‌شود، نه حذف آنی داده از مرورگر دیگر.
- subtotal فقط جمع کالاهاست؛ shippingToman/taxToman/payableToman=null و reserved/orderReady/paymentReady=false. هیچ stock یا reserved تغییر نمی‌کند. دو مشتری می‌توانند مستقل همان موجودی را quote کنند؛ رزرو آینده باید رقابت را اتمیک حل کند.
- مشتری/نشست فعال، تأیید شماره (جز synthetic demo)، Origin، محدودیت درخواست، مالکیت، no-store و guard سرور برقرار است. هیچ قیمت خصوصی در SSR/RSC عمومی یا DTO ویترین قرار نگرفته است.

## تغییرات و ردگیری

migration009 و schema مدل‌های ServerCart/ServerCartLine/CartOperation و FKهای restrictive و constraint نوع/تعداد را اضافه می‌کنند؛ روی dev/test اعمال شده‌اند. SQL قدیمی تغییر نکرده است. سرویس `src/server/cart.ts`، APIهای cart/quote، `server-basket.tsx`، صفحه/CSS basket، اتصال ویترین و WholesaleCatalog، variant ID عمومی (نه موجودی دقیق)، تست‌های backend/e2e و ADR018 افزوده/به‌روز شده‌اند. F03/F04 و مرحله07 پیش رفته‌اند؛ stage07 جزئی است چون رزرو ساخته نشده، F01..F16 حذف نشده‌اند.

## آزمون

۸۱ تست PostgreSQL شامل۱۴تست جدید سبد: auth/phone/demo، قیمت تزریقی، retry موازی، برخورد کلید، جداسازی نوع، محاسبهٔ دقیق، expiry، BOM مشترک، مالکیت/version، تعلیق همکار، تغییر قیمت، کسری stock، inquiry و عدم رزرو و constraintهای DB گذشتند. ۱۰ E2E production با سناریوی افزودهٔ افزودن واقعی از فید/جین، reload، تغییر تعداد، محاسبه، خطای کمبود و عرض‌های360/390/768/1440 گذشتند. خطای اولیهٔ locator alert به دلیل route announcer Next با scope main اصلاح شد؛ اجرای کامل بعدی موفق بود. cleanup فقط actor/product/customer مصنوعی همان تست را با bypass محلی transaction پاک می‌کند؛ هیچ TRUNCATE در dev و هیچ تغییر مالک واقعی/MFA انجام نمی‌شود.

## باقی‌مانده

مرحلهٔ بعد: رزرو اتمیک SKU با expiry/release، سفارش idempotent با snapshot پایدار، revalidation مجوز/قیمت در place و payment و آزمون رقابت/شکست. سپس محاسبهٔ ارسال/مالیات مطابق سیاست تأییدشده، درگاه sandbox و reconciliation. OTP، گروه‌بندی قیمت/tier، چندبعدی سایز، outbox، سیاست حقوقی، runtime کم‌اختیار، backup/restore و ممیزی مستقل بازند. checkout و noindex تغییر نکرده‌اند و دامنه deploy نشده است.

اعتبارسنجی تکمیلی: lint، typecheck، build production،۱۲unit، Prisma validate،۱۱تست Python و validator اسناد، git diff --check و npm audit --omit=dev (صفر آسیب‌پذیری گزارش‌شده) موفق بودند. این نتایج ممیزی مستقل امنیت یا آمادگی تولید نیستند.
