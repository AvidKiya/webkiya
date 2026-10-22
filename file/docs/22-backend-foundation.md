# ۲۲ — زیرساخت واقعی مرحلهٔ دوم

تاریخ: 2026-10-22 · نسخهٔ کد: 0.2.0 · شاخه: arena/f6a09f64-webkiya.

این گزارش مرجع وضعیت فعلی است؛ گزارش۲۱ snapshot مرحلهٔ اول است. **FULL هنوز تحویل نشده و پرداخت واقعی فعال نیست.**

## اجراشده با کد، نه ماکاپ

| بخش | پیاده‌سازی و شاهد | حد باقی‌مانده |
|---|---|---|
| دیتابیس | PostgreSQL واقعی 18.4 محلی، Prisma 7/pg، دو SQL migration تراکنشی با checksum و lock | HA، runtime-role محدود، backup/restore و پایش تولید انجام نشده؛ CI نسخه16 مستقل بررسی شود |
| نشست | token 256bit، hash در DB، cookie HttpOnly/SameSite/Secure در HTTPS، اعتبار۸ساعت، logout/revoke/expiry/version/isActive | هویت مشتری واقعی و مدیریت دستگاه‌ها هنوز نیست |
| ورود مشتری | endpoint آزمایشی جدا، فقط synthetic CUSTOMER، نیاز به APP_MODE=demo و ALLOW_DEMO_LOGIN=true هم‌زمان | OTP provider تنظیم نشده؛ phoneVerifiedAt برای demo جعل نمی‌شود؛ اطلاعات شخصی وارد نشود |
| CM عمومی | DB و API، DTO محدود، نویسنده/پاسخ تک‌سطحی همان پست، حذف نویسنده، moderation با دلیل، root/reply pagination، idempotency، سقف۵دیدگاه/دقیقه | گزارش تخلف، policy پیشرفته ضداسپم، realtime push و حذف گروهی هنوز نیست؛ تازه‌سازی دستی |
| پرسنل/MFA | bootstrap محلیِ یک‌بار، scrypt، TOTP/AES-GCM، جلوگیری از replay، هشت backup-code hashشدهٔ یک‌بارمصرف، rate limit | ممیزی مستقل، step-up کوتاه‌عمر، recovery پشتیبانی و مدیریت کامل پرسنل هنوز نیست |
| RBAC | Role/UserRole/permissions سروری، مجوز خواندن/پاسخ/moderate/بررسی/approve/suspend، نقش‌های پایهٔ OWNER/SUPPORT/CONTENT؛ مشتری همکار STAFF نمی‌شود | ویرایش نقش سفارشی، scope محصول/انبار و سازوکار last-owner هنوز ساخته نشده؛ هیچ endpoint ویرایش نقش عمومی وجود ندارد |
| WH پرونده | ثبت، مشاهدهٔ خود، بررسی پشتیبانی، تغییر وضعیت با reason و version، lock سطری، منع تأیید خود، audit تراکنشی | قیمت خصوصی، BOM، stock، quote/place و خرید عمده هنوز نیست؛ pricingReady=false حتی برای تأییدشده |
| مدیریت | /admin واکنش‌گرا، dashboard شمارش DB، دیدگاه/پرونده عملیاتی، محصولات/تیم/audit خواندنی طبق مجوز | پنل FULL نیست؛ هیچ آمار سفارش/فروش ساختگی ندارد |

پسند/ذخیره/سبد همچنان UI محلی‌اند. دیدگاه‌های قدیمی localStorage دور ریخته می‌شوند و بدون رضایت به سرور مهاجرت نمی‌کنند. اطلاعات sample و عکس‌های برش‌خوردهٔ مرجع باقی‌اند. عمده حداقل یک جین و بدون کف مبلغ، قیمت عمده در HTML/JS عمومی وجود ندارد. APP_MODE=live نشست demo را نامعتبر و دادهٔ دیدگاه demo را از فید واقعی خارج می‌کند.

## امنیت پیاده‌شده و مرز آن

- mutation با کنترل Origin؛ JSON محدود به16KiB به‌صورت stream و schema strict؛ هیچ نقشی از payload مشتری پذیرفته نمی‌شود.
- داده‌های مدیریتی و حساب، no-store؛ hash رمز، token و seed در DTO عمومی نیستند. seed MFA فقط برای تنظیم حساب خودش، در پاسخ no-store ارائه می‌شود، سپس تنها رمزگذاری‌شده در DB است. backup-code فقط یک‌بار نمایش داده می‌شود.
- counter محدودیت نرخ در PostgreSQL، نه Map فرایند؛ کلیدها HMAC و بدون IP خام‌اند. در نبود proxy قابل اعتماد کلید IP مشترک است؛ ممکن است همهٔ کاربران محلی در یک سقف قرار گیرند. TRUST_PROXY تنها پس از محافظت ingress فعال شود.
- audit append-only با trigger در برابر update/delete عادی؛ **نه تضمین عدم تغییر توسط DBA/DB owner**. connection محلی owner است؛ تولید باید role حداقلی جدا داشته باشد.
- عملیات تأیید همکار و audit یک transaction و lock/version دارند. ویرایش/ابطال نقش خارج از API جاری است؛ permissionها در هر درخواست از DB خوانده می‌شوند.
- این‌ها معادل تأیید امنیت تولید، انطباق حقوقی یا اتصال provider نیستند. دادهٔ واقعی، انتشار دامنه و دریافت پول در این مرحله مجاز اعلام نشده‌اند.

## شواهد تست محلی

- ۱۰ unit برای catalog/cart و local UI state بدون authority.
- ۱۹ integration روی DB جداگانهٔ PostgreSQL: cookie/expiry/logout/inactive/version، CSRF، جدایی demo، cross-session CM، مالکیت، parent constraint، retries هم‌زمان، moderation/audit immutability، MFA encryption/replay/recovery/rate-limit، RBAC، self-approval، تصمیم هم‌زمان همکار، pagination پاسخ، body limit، Secure HTTPS cookie و owner bootstrap یک‌بار.
- ۶ E2E روی build production: مشاهدهٔ دیدگاه توسط مرورگر مستقل، reload/reply، partner status، password/TOTP/recovery و مجوز UI/API، logout، کاتالوگ/سبد/تم/404/موبایل.
- نمای مدیریت در دسکتاپ۱۴۴۰ و موبایل۳۹۰ بصری بررسی شد؛ overflow در360/390/768/1024/1440 نبود؛ این معادل ممیزی کامل دسترس‌پذیری نیست.
- typecheck، lint، validate Prisma و production build اجرا شدند. جزئیات اجرای نهایی و نتیجهٔ CI در گزارش تحویل/خروجی CI قابل بررسی است؛ صرف وجود workflow اثبات اجرای GitHub نیست.
- هیچ snapshot یا secret/DB در Git ثبت نمی‌شود؛ fixture پرسنلی مرورگر موقت و محدود است و حذف می‌شود. integration تست فقط kiya_test را truncate می‌کند؛ این نام برای دادهٔ واقعی استفاده نشود.
- audit تولیدی npm جدا از ابزار توسعه بررسی می‌شود؛ پنج high در زنجیرهٔ lint توسعه از مرحلهٔ اول باقی است و fix-force ناسازگار اعمال نشده.

## ابزار و راه‌اندازی

راهنمای اجرایی و bootstrap در README ریشه است. `db:local` فقط local PostgreSQL از باینری npm، رمز تصادفی و .env.local با mode0600 می‌سازد. این نسخه برای سرور production توصیه نمی‌شود. compiler WASM npm برای Prisma generate/validate کافی است؛ native engine host در sandbox مسدود است. migration runner مستقل از pg و ledger `kiya_schema_migrations` استفاده می‌کند؛ prisma migrate deploy/reset با این ledger سازگار اعلام نشده و نباید خودکار اجرا شود. SQL نسخه‌دار مرجع constraint/trigger است؛ migration اعمال‌شده را تغییر نده.

## ترتیب بعد

۱) CRUD/انتشار محصول و واریانت/پک، staff lifecycle/custom-role با scope و محافظ last-owner؛ ۲) تأیید شماره با provider معتبر و سناریوهای recovery/ضداسپم؛ ۳) قیمت خصوصی، pack BOM و موجودی تراکنشی، سبد سروری و quote؛ ۴) رزرو/سفارش/idempotency/outbox و تست رقابت موجودی؛ ۵) sandbox پرداخت و آزمون قطع/تکرار callback، سپس بقیهٔ ماژول‌های FULL. فعال‌سازی واقعی provider تنها با secret تازه در محیط امن، نه چت.
