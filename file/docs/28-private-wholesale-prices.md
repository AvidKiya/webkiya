# ۲۸ — قیمت خصوصی همکار با تأیید مستقل و اعتبار

2026-10-22 · نسخه0.7.0 · شاخه arena/f6a09f64-webkiya. [نقشهٔ جاری](26-delivery-map.md) و `/progress` به‌روز شده‌اند. این مرحله نمایش قیمت اختصاصی است، نه تکمیل فروش عمده یا فعال‌سازی checkout.

## مسیر اجرایی

۱. کالا منتشرشده و جین ACTIVE باشد. حساب مشتری همکاری APPROVED و معتبر داشته باشد؛ در live شمارهٔ تأییدشده لازم است، demo صرفاً حساب مصنوعی صریح است.
۲. پروندهٔ کالا در پنل: «قیمت خصوصی عمده برای همکار مشخص». همکار و جین را انتخاب، mode، قیمت واحد صحیح تومان، شروع/پایان اعتبار و دلیل ثبت کنید. نرخ همهٔ اجزای یک جین در این نسخه یکسان است. عدد واقعی حدس زده یا seed نمی‌شود.
۳. ثبت، DRAFT می‌سازد. ثبت‌کننده—even OWNER—حق انتشار همان قیمت را ندارد. پرسنل دیگری با MFA و wholesale:price:publish باید از همان پرونده بررسی و منتشر کند. حساب مستقل به معنی تضمین هویت دو انسان مستقل نیست؛ IAM و اعتماد عملیاتی مالک لازم‌اند. هیچ حساب واقعی دوم یا MFA از طرف توسعه‌دهنده تنظیم نشده است.
۴. همکار در `/wholesale` فقط قیمت خود را می‌بیند: قیمت واحد عمده، مجموع یک جین و قیمت خردهٔ جاری سایت. کمبود موجودی فقط boolean است، تعداد دقیق stock/reserved یا SKU/cost در DTO نیست. حداقل یک جین، بدون کف مبلغ؛ هیچ سبد/سفارش/پرداختی ساخته نمی‌شود.
۵. در پروندهٔ همکارِ APPROVED، تنظیم اعتبار با reason/version و partner:approve؛ گذشته یعنی عدم دسترسی، null یعنی بدون انقضای زمانی تا تعلیق/تغییر. حالت پرونده می‌تواند APPROVED باشد ولی اعتبار منقضی است. انتشار مجدد قیمت بدون اعتبار همکار ممنوع است.

## مدل و کنترل‌ها

migration008: PartnerAccount.expiresAt و WholesaleOffer. FK مرکب pack/product، packVersion snapshot، partnerId، mode PRICED/INQUIRY، قیمت واحد Decimal(14,0)، بازهٔ اعتبار، DRAFT/PUBLISHED/ARCHIVED، version، creator/reviewer و requestId یکتا. مجموع قیمت جین با BigInt محاسبه و سقف۱۴رقم در API ثبت کنترل می‌شود؛ float و قیمت درصدی حدسی نداریم.

- قیمت ثبت‌شده حتی در DRAFT قابل UPDATE محتوایی یا DELETE نیست؛ بایگانی و تعریف جایگزین. وضعیت فقط DRAFT→PUBLISHED/ARCHIVED و PUBLISHED→ARCHIVED، با version+1. DB trigger از تغییر محتوا/حذف و CHECK از self-approval جلوگیری می‌کند. reviewer بعد انتشار ثابت است؛ actor بایگانی در audit می‌ماند.
- unique جزئی فقط یک PUBLISHED برای partner/pack، حتی اگر تاریخ آن گذشته یا شروع آن آینده باشد. برای جایگزینی اول بایگانی کنید؛ زمان‌بندی خودکار جانشین/لیست چندبازه‌ای ساخته نشده است.
- POST ایجاد با requestId UUID: lock درخواست، سپس Product، session/permission تازه داخل transaction، Partner SHARE lock و اعتبار/Pack بررسی می‌شود. retry همان actor/body همان id و وضعیت جاری را می‌دهد؛ mismatch409. تغییر وضعیت Product lock مشترک دارد؛ نسخهٔ قدیمی409، انتشار متناقض409. create/update audit در همان transaction و بدون عدد قیمت در data عمومی audit است. اعلان/outbox نداریم.
- خواندن خصوصی با Partner SHARE lock هم‌زمان با review/validity کنترل می‌شود؛ session تازه، kind CUSTOMER، active، شمارهٔ تأییدشده یا demo صریح، APP_MODE، APPROVED/expiry، Offer status/بازهٔ تاریخ، Product=PUBLISHED، Pack=ACTIVE و نسخه/اجزای فعال دوباره بررسی می‌شوند. در live دادهٔ نمونه و نشست demo مخفی/رد است. تأیید همکار مجوز ادمین ایجاد نمی‌کند.
- تخصیص **مستقیم** partner/pack است، نه لیست گروهی/عمومی. قیمت همکار دیگر fallback نیست. نبود تخصیص معتبر فهرست خالی/استعلام است؛ INQUIRY اصلاً unitPriceToman/packPriceToman ندارد، نه صفر یا null.

## API و رابط

- GET/POST `/api/admin/products/[id]/offers`: context تا۵۰جین ACTIVE،۱۰۰همکار واجدشرایط و۵۰قیمت اخیر؛ read با wholesale:price:read، write با wholesale:price:manage و MFA. اطلاعات شخصی تماس در context نیست؛ نام کسب‌وکار برای انتخاب است. pagination/search مدیریتی کامل هنوز لازم است.
- PATCH `.../offers/[offerId]/status`: wholesale:price:publish، نسخه و دلیل و منع تأیید creator. نقش پیشنهادی reviewer: dashboard:read + product:read + wholesale:price:read/publish؛ نقش entry به‌جای publish، manage دارد.
- PUT `/api/admin/partners/[id]/validity`: partner:approve، MFA، نسخه، دلیل و منع تغییر اعتبار پروندهٔ خود. reviewPartner قدیمی نیز پس از lock دوباره مجوز/نشست را بررسی می‌کند.
- GET `/api/wholesale/catalog`: فقط حساب مشتری خودش، بدون انتخاب partnerId دلخواه؛ private,no-store و Vary:Cookie. تا۱۰۰پیشنهاد معتبر؛ فیلدهای عمومی و خصوصی صریحاً ساخته می‌شوند. SSR/RSC/HTML/JSON عمومی عدد عمده نمی‌گیرد؛ اطلاعات خصوصی فقط پس از درخواست authenticated مرورگر می‌آید.
- GET `/api/partner`: expiresAt و privatePricingAvailable=true/orderReady=false افزوده شد. pricingReady قدیمی صرفاً flag خاموش checkout باقی است؛ اثبات وجود قیمت یا آمادگی فروش نیست.
- UI private state به userId متصل است، در تغییر حساب/refresh از حساب دیگر رندر نمی‌شود. شروع refresh/focus دادهٔ قدیمی را پنهان، هر۶۰ثانیه دوباره بررسی و انقضای زمانی را در UI اعمال می‌کند. این clock/caching هیچ اختیار مالی ندارد. تعلیق در **درخواست بعدی** فوری رد می‌شود؛ اطلاعاتی که قبلاً مجاز دریافت شده از حافظه/عکس گیرنده پس‌گرفتنی نیست. push revocation یا تضمین پاک‌کردن فوری صفحه نداریم.
- رنگ/سایز مستقل، لیست گروهی/tier، قیمت متفاوت هر جزء، inquiry به‌عنوان تیکت پایدار، export و quote/سفارش هنوز باقی‌اند. کارت‌های عمومی کالا همچنان استعلام‌اند؛ قیمت‌های اختصاصی در بخش مجزای حساب همکار نمایش داده می‌شوند.

## فایل‌ها و آزمون‌ها

Schema/migration008، `src/server/wholesale.ts` و routes offers/validity/wholesale/catalog؛ `wholesale-prices.tsx` و `wholesale-catalog.tsx`، اتصال به پروندهٔ کالا/همکار و صفحه عمده، labels/seed/perms، roadmap و docs. الگوی HTML handle/SKU برای Unicode-v مرورگر هم اصلاح شده؛ regex سرور تغییر نکرده است.

۱۴integration تازه: scope و privacy، self-approval، inquiry، validity، تکرار و رقابت، money/range/overflow، immutable replacement، schedule/expiry، stock/BOM/status و phone/live. مجموع۶۷ integration PostgreSQL. E2E مسیر مالک موقت با MFA، همکار مصنوعی، ثبت قیمت، بازبین موقت مستقل با MFA، نمایش فقط برای همکار، عدم وجود عدد در HTML/RSC/public JSON و قطع دسترسی با expiry را انجام می‌دهد. هیچ credential واقعی مالک در آن نیست. cleanup فقط داده‌های همان actor/product و حساب‌های مصنوعی تست را پاک می‌کند؛ نه دفتر مشترک یا حساب واقعی. integration فقط DB kiya_test را truncate می‌کند.

نتیجهٔ نهایی: lint بدون هشدار، typecheck، build، ۱۲unit،۶۷integration PostgreSQL،۱۰ E2E و Prisma validate موفق‌اند. audit وابستگی تولید صفر آسیب‌پذیری گزارش کرد؛ validator بسته و۱۱تست Python نیز موفق‌اند. ادیتور قیمت و کاتالوگ خصوصی در عرض۳۶۰/۳۹۰/۷۶۸/۱۴۴۰ بدون overflow افقی بررسی شدند. این‌ها ممیزی مستقل WCAG/امنیت یا نتیجهٔ CI راه‌دور نیستند.

## مرحلهٔ بعد و مرز آمادگی

سبد سروری جدا برای retail/wholesale و quote سروری با نسخه‌های قیمت/جین/اعتبار؛ سپس رزرو SKU با ترتیب lock ثابت، انقضا، سفارش idempotent و snapshot. در place/payment باید تمام guardهای همکار و قیمت دوباره بررسی شوند؛ صرف نمایش این صفحه اجازهٔ دریافت وجه نیست. SMS، درگاه، دامنه، runtime کم‌اختیار، backup/restore و ممیزی هنوز تنظیم/تأیید نشده‌اند؛ noindex و checkout خاموش‌اند.
