# کیا — KIYA

فروشگاه اجتماعی فارسی با هویت بنفش/طلایی. **مرحلهٔ دوم اکنون PostgreSQL واقعی، نشست سروری، گفت‌وگوی عمومی و زیرساخت مدیریت دارد.** هنوز فروشگاه آمادهٔ دریافت سفارش یا اطلاعات شخصی واقعی نیست.

## اجرای محلی

Node.js 22 و npm، در دو ترمینال:

```sh
npm ci
npm run db:local
```

ترمینال دوم، پس از پیام آماده‌بودن PostgreSQL:

```sh
npm run db:migrate
npm run db:seed
npm run dev -- --port 3000
```

`db:local` یک **PostgreSQL واقعی** از باینری npm اجرا می‌کند، نه SQLite یا شبیه‌ساز؛ فقط روی `127.0.0.1:55432`. داده در `.data/postgres` و اسرار تصادفی در `.env.local` ذخیره می‌شوند؛ هر دو از Git خارج‌اند. اگر `.env.local` از قبل وجود دارد، آن را بدون بررسی پاک نکن؛ [قالب تنظیمات](.env.example) را با محیط خود تطبیق بده. PostgreSQL در ترمینال اول باید روشن بماند. این ابزار مخصوص توسعه است، نه زیرساخت تولید.

برای خروجی تولیدیِ **همین محیط آزمایشی**: `npm run build` سپس `npm run start -- --port 3000`. وب‌سرور به `0.0.0.0` متصل می‌شود و previewهای `e2b.app` مجازند؛ مرورگر برای APIها فقط آدرس نسبی استفاده می‌کند. فونت و تصاویر محلی‌اند.

## آنچه کار می‌کند

- فید/اکسپلور RTL واکنش‌گرا، روشن/تیره، جست‌وجو و فیلتر، استوری، پست مستقیم/مودال و توضیح بیشتر/کمتر.
- دیدگاه و پاسخ **عمومی در PostgreSQL**، صفحه‌بندی دیدگاه و پاسخ‌ها، حذف فقط توسط نویسنده، پنهان‌سازی توسط پرسنل مجاز؛ retries با کلید idempotency.
- نشست opaque با token تصادفی و hash در DB، کوکی HttpOnly/SameSite، خروج و ابطال سروری، محدودیت نرخ در DB و کنترل Origin برای mutation.
- `/account`: ورود **صریحاً آزمایشی** فقط به حساب مصنوعی مشتری؛ نه SMS یا تأیید هویت. شماره یا اطلاعات شخصی واقعی وارد نکن.
- درخواست همکاری، وضعیت پایدار و بررسی با دلیل، کنترل نسخه، منع self-approval و ثبت audit.
- `/admin`: ورود رمز + TOTP، seed رمزگذاری‌شده، جلوگیری از بازپخش کد و هشت کد بازیابی یک‌بارمصرف. قبل MFA هیچ دادهٔ مدیریت ارائه نمی‌شود.
- مجوزهای سروری و نقش‌های پایهٔ مالک/پشتیبانی/محتوا؛ داشبورد با شمارش DB، moderation و بررسی همکار، فهرست خواندنی محصولات/تیم/audit مطابق مجوز.
- پسند، ذخیره و سبد همچنان **محلی** هستند. دیدگاه‌های محلی قدیمی خودکار منتشر یا به سرور منتقل نمی‌شوند.

## ساخت امن مالک اولیه

**مالک یا رمز پیش‌فرضی در محیط preview ساخته نشده است.** این کار فقط یک بار، با دسترسی محلی مورد اعتماد انجام می‌شود. در Bash، رمز را بدون نمایش و بدون قرار دادن در history/آرگومان بگیر:

```sh
read -r -s -p 'Owner password (14+ characters): ' KIYA_OWNER_PASSWORD; echo
export KIYA_OWNER_PASSWORD
npm run owner:create -- --handle kiya-owner --name 'مالک کیا'
unset KIYA_OWNER_PASSWORD
```

سپس `/admin`، رمز، تنظیم Authenticator و تأیید TOTP. کدهای بازیابی فقط یک بار نمایش داده می‌شوند؛ خارج از مرورگر امن نگه دار. رمز/کلید/کد بازیابی را در Git یا چت نفرست. ابزار مالک موجود را جایگزین یا reset نمی‌کند. کلید `MFA_ENCRYPTION_KEY` باید پایدار، پشتیبان‌گیری‌شده و امن بماند؛ تغییر خودسرانهٔ آن MFA را از کار می‌اندازد.

## آزمون‌ها

```sh
npm run db:test:create
npm run db:migrate:test
npm run db:seed -- --test
npm run prisma:validate
npm run lint
npm run typecheck
npm test
npm run test:backend
npm run build
npm run test:e2e
python3 file/scripts/validate_package.py
python3 -m unittest discover -s file/scripts -p 'test_*.py'
npm audit --omit=dev
```

- ۱۰ unit، ۱۹ تست یکپارچه روی PostgreSQL واقعی و ۶ E2E مرورگر.
- تست بک‌اند فقط DB جداگانهٔ `kiya_test` را می‌پذیرد و دادهٔ **همین DB تست** را پاک می‌کند؛ هرگز از نام `kiya_test` برای دادهٔ واقعی استفاده نکن.
- E2E فقط در محیط demo محلی اجرا شود: مشتری مصنوعی ثبت می‌کند و برای بررسی MFA یک پرسنل موقت با نقش محدود می‌سازد و حذف می‌کند؛ مالک پیش‌فرض نمی‌سازد. دادهٔ نمونهٔ دیدگاه/درخواست مشتری در demo می‌ماند.
- Playwright خروجی build را روی 3000 اجرا می‌کند یا سرور محلی موجود را استفاده می‌کند؛ بعد تغییر کد، build و restart لازم است. Chromium Linux x64 از npm تأمین می‌شود و CDN لازم ندارد.
- workflow شامل سرویس PostgreSQL 16 نوشته شده؛ نتیجهٔ اجرای GitHub را باید مستقل بررسی کرد.

## مهاجرت و محدودیت محیط

Prisma 7 با adapter استاندارد `pg` استفاده می‌شود. Client با compiler WASM موجود در npm تولید می‌شود؛ native schema-engine از شبکهٔ این sandbox قابل دانلود نیست. helper فقط `generate/validate` را اجرا می‌کند؛ جای engine برای migrate را جعل نمی‌کند.

**فرمان پشتیبانی‌شدهٔ migration در این مرحله `npm run db:migrate` است**: SQL نسخه‌دار، transaction، advisory lock و checksum با ledger مستقل `kiya_schema_migrations`. از `prisma migrate deploy/reset` روی این DB استفاده نکن؛ ledger آن ابزار در این مرحله baseline نشده است. SQL شامل constraint و triggerهایی فراتر از مدل Prisma است. نسخه‌های اعمال‌شده را تغییر نده؛ migration جدید بساز. در محیط توسعهٔ این sandbox PostgreSQL 18.4 اجرا شده؛ CI برای PostgreSQL 16 تنظیم شده، نه اینکه اجرای 16 از قبل اثبات شده باشد.

`npm run db:maintenance` bucketهای منقضی و نشست‌های منقضیِ بیش از ۳۰ روز را پاک می‌کند؛ زمان‌بندی آن هنوز با supervisor/cron انجام نشده است. audit به‌صورت خودکار حذف نمی‌شود.

## هنوز تکمیل نشده

OTP واقعی/بازیابی مشتری، نقش سفارشی و چرخهٔ عمر کامل پرسنل، scopeهای ریزدانه، مدیریت و انتشار کامل کالا، قیمت خصوصی عمده/BOM، موجودی، سبد سروری، quote/reservation/order/payment، اتصال پیامک/تلگرام و بقیهٔ ماژول‌های FULL. تأیید همکار **قیمت عمدهٔ ساختگی یا مجوز مدیریت ایجاد نمی‌کند**؛ تا لیست قیمت واقعی متصل نشود فقط وضعیت پرونده دیده می‌شود. MOQ یک جین و بدون کف مبلغ حفظ شده است.

تصاویر/محصولات/قیمت‌ها نمونه‌اند. قبل داده یا پرداخت واقعی: ممیزی امنیت، DB runtime با حداقل مجوز جدا از migration-owner، backup/restore، مانیتورینگ/نگهداری، provider و آزمون‌های مالی لازم است. trigger audit در برابر حساب برنامه مانع update/delete عادی است، نه DBA یا مالک DB. اتصال local در این مرحله مالک DB است. `APP_MODE=live` و `ALLOW_DEMO_LOGIN=false` ورود و نشست‌های demo را می‌بندند، اما **به‌تنهایی سایت را آمادهٔ فروش نمی‌کنند**. Secure cookie در HTTPS و محیط تولیدِ غیر-demo فعال است؛ HTTP فقط برای demo محلی است. تنظیمات forwarded IP فقط پشت ingress کنترل‌شده مجاز است.

## مشخصات و گزارش

- [مرحلهٔ دوم و شواهد/حدود](file/docs/22-backend-foundation.md)
- [گزارش تاریخی مرحلهٔ اول](file/docs/21-implementation-progress.md)
- [شروع مشخصات کامل](file/START-HERE.md)، [پرامپت](file/prompts/BUILD-KIYA.md)، [تصمیم‌های مالک](file/docs/14-owner-addendum.md)

هیچ DNS، درگاه، سرویس پیامکی یا توکن تولیدی تنظیم یا تغییر نکرده است. noindex باقی است. اسرار فقط در محیط امن، نه Git/چت.
