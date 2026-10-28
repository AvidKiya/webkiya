# ۲۷ — تعریف جین واقعی و نقشهٔ قابل مشاهده

نسخه0.6.0 · 2026-10-22 · ادامهٔ گزارش۲۵. مرجع وضعیت کلی [نقشه۲۶](26-delivery-map.md) و `/progress` است.

## خروجی اجرایی

- مدل PackDefinition/PackComponent با FK مرکب برای جلوگیری از آوردن SKU محصول دیگر؛ تعداد هر جزء مثبت، مجموع≤۱۰۰۰۰، حداکثر۳۰جزء و۲۰تعریف بایگانی‌نشده در هر کالا.
- HOMOGENEOUS فقط یک SKU و FIXED_ASSORTMENT ترکیب ثابت چند SKU. مجموع unitsPerPack را سرور از اجزا حساب می‌کند؛ client فیلد مجموع/stock/price یا policy دلخواه نمی‌فرستد. واحد جین از دادهٔ واقعی است، نه۱۲ثابت.
- POST/GET `/api/admin/products/[id]/packs`، PUT `.../[packId]` و PATCH `.../[packId]/status`. خواندن product:read+MFA، نوشتن wholesale:pack:manage، فعال‌سازی/بایگانی wholesale:pack:publish. OWNER هر دو مجوز تازه را دارد؛ قابل تفویض عملیاتی از IAM واقعی‌اند.
- ساخت/ویرایش فقط DRAFT pack در DRAFT product، optimistic version، Product row-lock مشترک با variant/stock/status و reauthorization در transaction. اجزا+جمع+audit اتمیک‌اند؛ درخواست رقابتی با نسخهٔ قدیمی409.
- DRAFT→ACTIVE فقط پس از انتشار خود کالا و اعتبار دوبارهٔ همهٔ اجزا؛ DRAFT/ACTIVE→ARCHIVED. ACTIVE قابل ویرایش نیست و ARCHIVED فعال/ویرایش نمی‌شود؛ جایگزین جدید بسازید. این workflow مالیِ approval دومنفره نیست.
- DB trigger اجزای غیرDRAFT را در INSERT/UPDATE/DELETE محافظت، تغییر definition فعال را فقط به archive با version+1 محدود، و دستکاری definition بایگانی را منع می‌کند. constraint trigger مؤخر، جمع و تعداد/فعال‌بودن اجزای ACTIVE را در commit کنترل می‌کند. FKها قید یک‌محصول دارند. DBA همچنان می‌تواند قیود را دور بزند؛ runtime تولید باید حداقل مجوز داشته باشد.
- رنگ عضو ACTIVE pack تا بایگانی بسته قابل تغییر نام/hex/فعال‌بودن نیست؛ service409 و DBguard دارند. تغییر stock/version انبار همچنان ممکن است و بسته موجودی جعلی ایجاد نمی‌کند.
- بایگانی خود کالا لزوماً pack را archive نمی‌کند؛ هر مصرف آیندهٔ BOM باید **هم Product=PUBLISHED و هم Pack=ACTIVE** و versions/اجزای معتبر را دوباره کنترل کند. quote/place هنوز نداریم.

## رابط

پروندهٔ کالا → «تعریف واقعی جین و ترکیب رنگ‌ها». فرم ترکیب با تعداد هر رنگ، مجموع، نوع بسته، ویرایش پیش‌نویس، دلیل وضعیت و مجوزها. رنگ غیرفعال را در ویرایش با صفر از ترکیب حذف کنید. فهرست تا۵۰تعریف اخیر است؛ pagination حرفه‌ای بعدی است. پس از خطای نامشخص شبکه پیش از ساخت دوباره refresh کنید؛ POST تعریف هنوز idempotency-key ندارد، duplicate تعریف، فروش یا تغییر موجودی ایجاد نمی‌کند.

«تعداد واحد بسته» قبلی metadata است و جای BOM را نمی‌گیرد. رابط عمدهٔ کالای واقعی تا اتصال approved/private API از آن تعداد، ترکیب قابل سفارش یا جمع واحد قطعی نمی‌سازد؛ همچنان استعلام است. نمونه‌ها با عنوان نمونه باقی‌اند.

`/progress` صفحهٔ عمومی ثابتِ نقشه است، بدون query اطلاعات عملیاتی یا API خصوصی. وضعیت دادهٔ دستی نسخه‌دار است؛ لینک در پنل و هدر دسکتاپ. برچسب انجام‌شده فقط محدودهٔ ذکرشده را پوشش می‌دهد. همهٔ F01..F16 در گزارش۲۶ باقی مانده‌اند.

## فایل‌ها و داده

- migration006: مدل‌ها، FK، اعتبار deferred BOM و مجوزهای OWNER؛ migration007: immutability/guardهای اجزا/definition/SKU. migrationهای اعمال‌شدهٔ قدیمی و checksum تغییر نکردند. هر دو DB dev/test مهاجرت شدند؛ seed هیچ ترکیب/قیمت/stock واقعی حدسی نمی‌سازد.
- `src/server/packs.ts`، routes زیر products/[id]/packs، `pack-manager.tsx` و اتصال به product-workbench؛ guard تازه در product-workflow، permission catalog/labels/seed.
- `src/lib/delivery-map.ts`، `src/app/progress`، اجازهٔ route در proxy و لینک‌های پنل/فروشگاه؛ docs۲۶/۲۷، README/START/ADR016.
- تست‌های افزوده و cleanup مخصوص DB تست؛ E2E فقط pack/component/stock/productِ actor موقت خودش را با شرط audit پاک می‌کند. حساب واقعی مالک و MFA او هیچ reset یا enrollment نداشته‌اند.

## مرز تکمیل

تعریف بسته واقعی در DB است، اما فروش عمده نیست. هنوز: قیمت خصوصی/لیست/تخصیص، scope و انقضای همکار، نمایش بسته برای همکار، سبد سروری، quote/reservation/order/payment، snapshot مالی و approval حساس. سایز مستقل/MIX_AND_MATCH/قیمت متنوع هر جزء و outbox بعد commit هم بازند. audit در همان transaction است؛ هیچ اعلان بیرونی ادعا نمی‌شود.

هیچ DNS، درگاه، پیامک یا token تولیدی تنظیم نشده است؛ noindex/checkout غیرفعال‌اند. این مرحله آماده‌بودن تولید یا تکمیل FULL را اعلام نمی‌کند.

## بررسی‌ها

۱۰ تست integration تازه برای مجوز، BOM غیر۱۲، ترکیب چندرنگ، ورودی نامعتبر، FK/رنگ غیرفعال، version/race، activation، immutability و archive-first افزوده شد؛ مجموع۵۳. E2E مسیر واقعی عکس/SKU/stock تا ساخت جین۶تایی و فعال‌سازی، و صفحهٔ نقشه با responsive/privacy را بررسی می‌کند؛ مجموع۱۰. ۱۲unit نیز حفظ شده است. lint بدون هشدار، typecheck، Prisma validate، build و۱۰ E2E نهایی موفق‌اند. ۱۲unit و۵۳integration PostgreSQL نیز موفق؛ audit وابستگی تولید صفر آسیب‌پذیری گزارش کرده است. validator بسته و۱۱تست Python هم موفق‌اند. ادیتور باز در عرض۳۶۰/۳۹۰/۷۶۸/۱۰۲۴/۱۴۴۰ و نقشه در۳۶۰/۳۹۰/۷۶۸/۱۴۴۰ بدون overflow افقی تست شدند. ادعای نتیجهٔ CI راه‌دور، WCAG کامل یا ممیزی تولید نداریم.
