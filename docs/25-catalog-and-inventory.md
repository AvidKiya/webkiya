# ۲۵ — کاتالوگ دیتابیسی، تصویر و موجودی

2026-10-22 · نسخه0.5.0 · arena/f6a09f64-webkiya. ادامهٔ گزارش۲۴ است، نه اعلام تکمیل FULL یا انتشار kiyaco24.ir.

## مسیر واقعی مدیر

۱. ورود `/admin` با حساب خود، رمز و MFA شخصی؛ حساب واقعی مالک reset/جایگزین/توسط توسعه‌دهنده MFA-enroll نشده است.
۲. «کاتالوگ»، ساخت پیش‌نویس، بازکردن «مشخصات، رنگ‌ها، موجودی و انتشار».
۳. نام، عنوان کوتاه، دستهٔ مجاز، توضیح، قیمت صحیح تومان، تعداد واحد بسته، برچسب/مجموعه و عکس اصلی. عکس فقط پس از «ذخیره مشخصات کالا» به محصول متصل می‌شود. لباس زیر مجاز و لباس معمولی خارج است.
۴. رنگ با نام، hex و SKU یکتای سراسری اضافه کنید. SKU ثابت است؛ رنگ/فعال‌بودن فقط در DRAFT قابل ویرایش است. موجودی همهٔ رنگ‌های تازه صفر است و فقط با اصلاح مستند تغییر می‌کند.
۵. انتشار جداگانه با دلیل و مجوز product:publish؛ عنوان/دسته/توضیح حداقل۲۰نویسه/قیمت مثبت/تعداد واحد بسته/تصویر اصلی و حداقل یک رنگ فعال لازم است. موجودی صفر به معنی «ناموجود» در ویترین است، نه خطای ثبت محصول.
۶. ویرایش زنده ممنوع؛ PUBLISHED→ARCHIVED→DRAFT→PUBLISHED. کالا/رنگ دارای رزرو غیرفعال یا بایگانی نمی‌شود. سفارش یا رزروی در این مرحله ایجاد نمی‌شود؛ guard برای حفظ invariant است.

## مدل و API

migration005: metadata عمومی Product، MediaAsset، ProductVariant و InventoryMovement با قیدهای DB. stock/reserved شمارش واحد تکی هستند؛ 0≤reserved≤stock≤1e9. دفتر موجودی trigger منع UPDATE/DELETE و UUID درخواست یکتا دارد. محاسبات موجودی integer و قیمت Decimal(14,0) رشته‌ای است.

- GET `/api/catalog`، SSR `/`، بخش‌های فروشگاه و `/p/[id]`: فقط PUBLISHED و در live فقط غیرنمونه. DTO صریح: قیمت خرده/متن/عکس/رنگ و available boolean؛ نه stock/reserved/SKU/هزینه/قیمت عمده. take100 و ترتیب پایدار؛ محصول بازشدهٔ مستقیم در صورت بیرون‌بودن از100 به catalog همان صفحه اضافه می‌شود. صفحه‌بندی عمومی/جست‌وجوی کل DB هنوز لازم است.
- GET `/api/admin/products/[id]`: پروندهٔ metadata و رنگ/SKU با product:read و MFA، بدون عدد انبار.
- PUT `.../details`، POST/PATCH `.../variants[/variantId]`: product:write، DRAFT، version، validation، lock و audit. stock/isDemo/status یا فیلد قیمت خصوصی دلخواه از client پذیرفته نمی‌شود؛ قیمت فقط در فیلد معتبر قیمت قابل تغییر است، stock/status endpoint مستقل دارند.
- PATCH `.../status`: product:publish، transition و version و reason.
- GET `.../inventory`: inventory:read؛ تعدادها و آخرین۳۰movement، نه گزارش نامحدود.
- POST `/api/admin/inventory/[variantId]`: inventory:manage، delta غیرصفر تا±1e6، دلیل، version و requestId UUID. lock درخواست سپس Product→Variant، reauthorization، نسخه و floor رزرو؛ تغییر تعداد+ledger+audit اتمیک. retry با actor/variant/delta/reason/beforeVersion یکسان همان نتیجه را می‌دهد؛ کلید تکراری با payload دیگر409، رقابت version قدیمی409. تاریخچه حذف یا overwrite نمی‌شود.
- mutationها Same-Origin و MFA و rate-limit DB دارند؛ مجوزهای تازه برای OWNER و قابل تفویض عملیاتی با نقش سفارشی‌اند. scope انبار/کالا هنوز نیست.

فید از DB می‌آید، نه fixture مرورگر؛ پسند/ذخیره/سبد همچنان محلی‌اند و catalog جاری برای پاک‌کردن شناسهٔ ناپدیدشده و محاسبهٔ جمع استفاده می‌شود. سبد سفارش یا قیمت معتبر پرداخت نیست. نمونه‌ها صریح برچسب دارند و در demo حتی با stockصفر فقط برای تجربهٔ UI قابل افزودن‌اند؛ در live نمایش داده نمی‌شوند. seed metadata خالی را backfill می‌کند، نام/قیمت/وضعیت ویرایش‌شده را بازنویسی نمی‌کند و برای نمونه فقط در فقدان هر رنگ، رنگ‌های صفرstock می‌سازد.

## رسانه

POST `/api/admin/media`: product:write، MFA و Origin؛ دریافت محدود۶MB برای multipart و فایل تا۵MB، JPG/PNG/WebP ثابت، حداقل۲۰۰px و ورودی حداکثر۲۵MP. sharp decode، چرخش صحیح، کاهش تا۱۶۰۰px، WebP و حذف EXIF؛ SVG/remote URL/path traversal پذیرفته نمی‌شوند. نام اصلی فایل ذخیره نمی‌شود. SHA256 محتوای خروجی نام فایل و id است؛ MediaAsset metadata و audit به‌صورت تراکنشی ثبت می‌شوند. عکس معتبرِ بدون اتصال می‌تواند orphan شود؛ GC خودکار هنوز نیست.

GET `/api/media/[hash]`: تصویر فقط وقتی به PUBLISHED متصل است عمومی؛ در غیر این صورت staff مجاز با MFA، و برای بقیه404. bytes با image/webp، nosniff و no-store ارسال می‌شود؛ پروندهٔ مدیریت از Image unoptimized استفاده می‌کند. عکسِ یک‌بار عمومی‌شده را پس از بایگانی نیز راز فرض نکنید؛ cache مرورگر/نسخهٔ دانلودشده قابل پس‌گرفتن نیست.

`.data/media` یا MEDIA_ROOT مطلق، خارج Git؛ backup DB بدون volume تصویر کافی نیست. quota کل، orphan retention/GC، object-storage، چندinstance، مانیتورینگ و بازیابی backup پیش از تولید لازم‌اند. تبدیل تصویر جای ممیزی امنیت/سیاست محتوایی یا مجوز صنفی نیست.

## شواهد

۱۲ unit، ۴۳ integration واقعی PostgreSQL و۹ E2E. ۱۱ integration تازه برای DTO/privacy/live-hide، انتشار و تصویر خصوصی/عمومی/EXIF، SVG/size validation، SKU/version، جداسازی مجوز، retry موازی/idempotency mismatch، رقابت موجودی، stock/reserved و append-only. E2E تازه از مالک موقت با MFA تا ثبت عکس، SKU، stock۸، انتشار، نمایش مستقیم و بایگانی404 را در مرورگر می‌رود؛ هیچ رمز واقعی مالک در تست نیست. lint/typecheck/Prisma validate/build موفق و audit وابستگی تولید صفر آسیب‌پذیری گزارش کرد. ادیتور واقعی با فرم باز در عرض‌های۳۶۰/۳۹۰/۷۶۸/۱۰۲۴/۱۴۴۰ بدون overflow بررسی شد. validator بسته و۱۱تست Python هم موفق‌اند. این نتایج ممیزی مستقل تولید یا موفقیت CI راه‌دور نیستند.

integration فقط kiya_test را truncate می‌کند و MEDIA_ROOT مخصوص test دارد. E2E در DB demo فقط fixture خود را با audit همان actor پاک می‌کند؛ bypass trigger تنها روی connection/session تراکنش cleanup و برای همان ledger rows است، نه endpoint محصول یا غیرفعال‌سازی سراسری trigger. DB محلی هنوز migration-owner است؛ production runtime باید حداقل مجوز مستقل داشته باشد.

## باقی‌ماندهٔ واقعی

packSize **BOM نیست**؛ ترکیب رنگ/سایز جین، قیمت خصوصی همکار تأییدشده، quote معتبر، رزرو و انقضا، سفارش، پرداخت/webhook/reconciliation/refund و لجستیک هنوز ساخته نشده‌اند. حداقل عمده یک جین حفظ شده؛ ۱۲تایی یا کف مبلغ جعلی اضافه نشده است. رسانه چندتصویری، سایز/چندبعد variant، pagination، multiwarehouse، CMS/story، اعلان/پشتیبانی واقعی، OTP پیامکی، deployment دامنه و ممیزی تولید بازند. noindex و checkout غیرفعال باقی‌اند؛ هیچ سرویس خارجی جعل نشده است.
