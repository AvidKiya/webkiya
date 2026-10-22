# آماده‌سازی Cloudflare — نسخهٔ 0.11.0

2026-10-22 · شاخهٔ `arena/f6a09f64-webkiya`

## وضعیت واقعی

**هیچ استقراری در حساب Cloudflare مالک انجام نشده و آدرس عمومی تأییدشده‌ای نداریم.** build، dry-run و آزمون محلی `workerd` با PostgreSQL واقعی انجام شده‌اند؛ این‌ها معادل deploy نیستند. دامنهٔ `kiyaco24.ir`، DNS، پرداخت، پیامک و حساب مدیر کل روی سرویس خارجی تنظیم نشده‌اند.

در محیط فعلی، API کلادفلر در دسترس شبکه نیست و connector آن پشتیبانی نمی‌شود. اتصال GitHub برای Secrets/Actions API پاسخ `403 Resource not accessible by integration` می‌دهد. توکن ارسالی مالک در کد، workflow، فایل تنظیمات یا فرمان‌ها ذخیره نشده است. هیچ سرویس پولی، دیتابیس خارجی یا bucket واقعی خودکار ساخته نشد.

محیط بازیابی‌شده فقط سورس Git داشت؛ دیتابیس و فایل‌های خصوصی محلی قبلی همراه آن نبودند. برای تست، دیتابیس محلی تازه با fixture ساخته شد؛ **این حساب/دادهٔ واقعی مدیر قبلی نیست**. رمز یا MFA مدیر کل حدس زده، بازنشانی یا غیرفعال نشده است. انتقال حساب قبلی فقط با دیتابیس/backup واقعی و کلید MFA اصلی ممکن است.

## چه چیزی آماده شد؟

- Next با OpenNext برای Workers؛ نه آپلود قالب Vite/mock به‌عنوان فروشگاه واقعی.
- اتصال Prisma/PostgreSQL با client و pool جدا برای هر درخواست Worker، بستن پس از پایان/لغو stream؛ اشتراک اتصال شبکه بین درخواست‌ها نداریم.
- عکس در Workers به bucket خصوصی `KIYA_MEDIA` می‌رود، نه فایل‌سیستم موقت. پردازش از binding `IMAGES` استفاده می‌کند؛ مسیر Node همچنان Sharp و فایل‌سیستم قبلی است.
- محدودیت ورودی ۵MB، raster JPEG/PNG/WebP، ۲۵MP، حداقل ۲۰۰px، منع animation و خروجی WebP حداکثر ۱۶۰۰px؛ خروجی دارای EXIF/XMP پذیرفته نمی‌شود. RBAC/MFA/audit و مجوز خواندن عکس منتشرنشده حفظ شده‌اند. اعتبارسنجی سرور تغییر نکرده و bucket عمومی نمی‌شود.
- cron هر دقیقه، حداکثر ۱۰۰ رزرو سررسیدشده را با همان تابع اتمیک PostgreSQL آزاد می‌کند. تأخیر اجرای cron/صف محتمل است؛ این زمان‌بندی جای بررسی اعتبار رزرو در خود تراکنش را نمی‌گیرد.
- `APP_MODE=live` و `ALLOW_DEMO_LOGIN=false` در تنظیم انتشار؛ هیچ demo seed یا ساخت خودکار مدیر در workflow انتشار نیست.
- کش ISR اشتراکی استفاده نمی‌شود. داده‌های خصوصی و قیمت عمده همچنان server-only/no-store هستند.
- خروجی dotenv پیش‌فرض OpenNext پاک می‌شود تا `.env.local` به Worker نشت نکند. dry-run، artifact و assets را از نظر مقادیر خصوصی اسکن می‌کند. کلیدها فقط از Worker Secrets وارد اجرا می‌شوند.
- workflow انتشار پیش‌نمایش روی `workers.dev`، preflight دیتابیس/توکن/bucket، نصب Secrets با stdin و smoke test واقعی پس از deploy آماده است. DNS تغییر نمی‌کند.

## پیش‌نیازهای واقعی، بدون ارسال رمز در چت

۱. یک PostgreSQL پایدار و بیرون از sandbox، با TLS و دسترسی شبکه از Workers و runner. آدرس localhost قابل استقرار نیست؛ D1 جایگزین سازگار این schema نیست و Hyperdrive خودش دیتابیس ایجاد نمی‌کند. backup بگیرید و migrationهای موجود را با `npm run db:migrate` در محیط امن اجرا کنید؛ workflow انتشار فقط checksum تمام migrationها را بررسی می‌کند و reset/migrate/seed خودکار ندارد. تصاویر قبلی نیز باید از storage اصلی به کلیدهای `media/<id>.webp` در R2 منتقل شوند؛ اتصال دیتابیس به‌تنهایی عکس‌ها را منتقل نمی‌کند.

۲. در همان Cloudflare account:
- private R2 bucket با نام `kiya-private-media`، بدون public access؛
- Workers subdomain فعال روی `workers.dev`؛
- امکان استفاده از Workers و Images binding و بودجهٔ کافی؛ bundle فعلی تقریباً **۳۲۸۱KiB فشرده** است، پس روی سقف ۳MiB نسخهٔ رایگان حساب نکنید. CPU و حافظهٔ ورود scrypt/Prisma نیز باید روی پلن واقعی آزموده شود؛ آزمون محلی محدودیت CPU تولید را شبیه‌سازی نمی‌کند؛
- API token مخصوص همین حساب با دسترسی انتشار Worker و مشاهدهٔ bucket R2. دسترسی DNS لازم نیست. توکن قبلاً ارسال‌شده را جایگزین کنید و مقدار جدید را فقط در Secrets وارد کنید.

۳. در GitHub، Settings → Environments، محیط `cloudflare-preview` را بسازید، reviewer و محدودیت branch مناسب قرار دهید، و این Environment Secrets را مستقیماً وارد کنید:

| نام | مقدار مورد نیاز |
|---|---|
| `CLOUDFLARE_API_TOKEN` | توکن جدید و محدود به حساب |
| `CLOUDFLARE_ACCOUNT_ID` | شناسهٔ واقعی همان حساب |
| `DATABASE_URL` | اتصال خارجی PostgreSQL با `sslmode=require/verify-full/verify-ca` |
| `AUTH_SECRET` | رشتهٔ تصادفی امن حداقل ۳۲ کاراکتر |
| `MFA_ENCRYPTION_KEY` | ۶۴ کاراکتر hex؛ برای دیتابیس موجود **همان کلید اصلی**، نه کلید جدید تصادفی |

این اطلاعات را در issue، commit، workflow input، log، فایل عمومی یا چت قرار ندهید. اگر تنظیمات Secrets را نمی‌توانید انجام دهید، سطح دسترسی اتصال GitHub باید اصلاح شود؛ اتصال فعلی ایجنت این مجوز را ندارد.

## اجرای انتشار از همین شاخه

- workflow `.github/workflows/cloudflare-preview.yml` روی push همین شاخه موجود است، ولی **پیش‌فرض خاموش** است.
- فقط پس از آماده‌بودن منابع/backup/پلن و Secrets، در Settings → Secrets and variables → Actions → **Repository Variables** مقدار `CF_PREVIEW_ENABLED=true` را قرار دهید. سپس push بعدی همین شاخه workflow را فعال می‌کند و environment approval اعمال می‌شود. تنظیم false انتشارهای بعدی را متوقف می‌کند؛ Worker موجود را پاک نمی‌کند.
- `workflow_dispatch` با تأیید `resources_reviewed` نیز تعریف شده، اما GitHub برای نمایش/اجرای آن به وجود workflow روی default branch نیاز دارد. این تغییرات به default branch ادغام نشده‌اند؛ صرف افزودن فایل روی شاخه به معنی وجود دکمهٔ Run workflow نیست. مسیر push بالا به ادغام نیاز ندارد.
- preflight از API حساب، آدرس واقعی `kiya-store-preview.<subdomain>.workers.dev` را می‌خواند؛ هیچ دامنه یا account ID فرضی جایگزین نمی‌شود. اتصال TLS و checksum دیتابیس و وجود bucket هم بررسی می‌شوند.
- پس از build و secret scan، Worker Secrets از stdin تنظیم می‌شوند، deploy انجام می‌شود و `/progress`، `/api/catalog` و `/api/auth/me` از آدرس واقعی بررسی می‌شوند. فقط پس از موفقیت این مراحل می‌توان آدرس را تحویل داد. خطای smoke را موفقیت انتشار حساب نکنید؛ smoke فعلی rollback خودکار انجام نمی‌دهد.
- تغییر Worker موجود با همین نام ممکن است Secretها را به‌روز کند؛ این نام مخصوص preview باشد، نه سرویس تولید دیگری. برای توقف یا بازگشت، از Deployments/Versions همان Worker نسخهٔ قبلی را انتخاب کنید؛ migration و کلید MFA را خودسرانه برنگردانید.

## آزمون محلی و محدودیت‌ها

پس از اجرای راهنمای محلی README و آماده‌شدن `kiya_test`:

```sh
npm run cf:build
npm run cf:dry-run
npm run cf:check-local
```

`cf:check-local` فقط URL با نام دیتابیس `kiya_test` را می‌پذیرد؛ Worker موقت را روی 8788 اجرا و بعد می‌بندد. فایل‌های موقت، تنظیمات محرمانه، WASM و bundleها ignored هستند. برای توسعهٔ تعاملی، `cf:preview` روی 8787 است؛ `.dev.vars` محلی لازم دارد و **روی Cloudflare حساب شما deploy نمی‌کند**. Wrangler ممکن است برای دادهٔ اختیاری `Request.cf` هشدار شبکه بدهد؛ تست محلی از fallback استفاده می‌کند، نه API واقعی Cloudflare.

نتایج این نسخه: ۱۰۳ تست backend شامل ۶ آزمون جدید runtime/R2/تصویر، ۱۲ unit، ۱۳ مرورگر و ۱۱ Python؛ lint/typecheck/Prisma/docs و build و dry-run Workers و smoke محلی workerd شامل routing/404، PostgreSQL، ورود نامعتبر با scrypt، demo غیرفعال، درخواست‌های هم‌زمان و cron بررسی شده‌اند. تست‌های R2/Images در backend از mock binding استفاده می‌کنند؛ ذخیره و پردازش واقعی تصویر در حساب خارجی، ورود واقعی مدیر با MFA، ظرفیت/CPU/هزینه، شبکهٔ دیتابیس خارجی و recovery هنوز نیازمند آزمون بعد از دسترسی‌اند. تمام نتایج بالا محلی‌اند؛ نتیجهٔ GitHub Actions یا حساب Cloudflare واقعی نیستند.

### پل سازگاری نسخه‌های فعلی

OpenNext اجرای Node middleware را experimental می‌داند. `scripts/cloudflare/build.mjs` برای نسخه‌های قفل‌شدهٔ Next 16.4.2 / Prisma 7.10.1 / OpenNext 1.20.13 سه اصلاح محدود **فقط روی خروجی generated/ignored** اعمال می‌کند:

1. query compiler WASM از binding استاتیک Worker می‌آید؛ تولید WASM از base64 در runtime Workers مجاز نیست.
2. Promise خروجی middleware قبل از ESM interop await می‌شود.
3. middleware به socket واقعی `pg-cloudflare` متصل می‌شود، نه empty export شرط Node.

هر اصلاح exact-match guard دارد و تغییر ساختار dependency، build را متوقف می‌کند. client استاندارد Node در `finally` دوباره generate می‌شود؛ فایل schema و migration اصلی تغییر نمی‌کند. CI علاوه بر مسیر Node، build/dry-run و smoke واقعی workerd روی PostgreSQL تست را اجرا می‌کند. ارتقای این dependencies بدون اجرای دوبارهٔ این آزمون‌ها مجاز نیست. این پل، تضمین پشتیبانی رسمی یا آمادگی تولید نیست.

`npm audit --omit=dev` صفر است. ۵ هشدار high باقی‌مانده در زنجیرهٔ dev/lint مربوط به braces/micromatch/fast-glob/ESLint است؛ نسخهٔ اصلاح‌شدهٔ braces در registry فعلی موجود نیست. مشکل glob ابزار build با override به 10.5.0 رفع شد؛ از `audit fix --force` و downgrade ناسازگار Next/ESLint استفاده نشده است.

**دامنهٔ FULL عوض نشده:** پرداخت، SMS، ارسال، چرخهٔ کامل مدیریت سفارش و بقیهٔ موارد باز نقشهٔ ۲۶ با آماده‌شدن این بسته انجام‌شده محسوب نمی‌شوند. انتشار preview با فعال‌بودن فروش واقعی یا انتقال حساب مدیر یکسان نیست.
