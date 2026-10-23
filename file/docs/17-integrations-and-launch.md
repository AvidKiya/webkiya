# ۱۷ — اتصال‌ها، env و راه‌اندازی امن

## اصلاح اجرایی 2026-10-23

[سند۳۳](33-telegram-and-card-transfer.md) مسیر پیاده‌شدهٔ ورود موقت تلگرام، دکمهٔ getMe/ثبت یا حذف webhook، worker و کارت‌به‌کارت را شرح می‌دهد. متن زیر قرارداد اولیه و وضعیت اتصال‌های **واقعی** است؛ اتصال واقعی همچنان تأیید نشده و هیچ HEALTHY یا فعال‌سازی تولید از ورود کلید استنباط نمی‌شود. SMS و gateway آنلاین جایگزین موقتِ فعال ندارند؛ ورود تلگرام و بررسی دستی رسید جایگزین‌های فعلی درخواست مالک‌اند.

## وضعیت اکنون
این سند wiring **مورد انتظار سازنده** است، نه ادعای برقراری اتصال. هیچ network call به تلگرام/اینستاگرام/درگاه انجام نشده است. فایل config/brand.json فقط دادهٔ عمومی و config/integrations.json فهرست وضعیت‌هاست؛ هیچ state برابر CONNECTED نیست.

| اتصال | عمومی موجود | نیاز خارجی | آزمون نهایی |
|---|---|---|---|
| دامنه/TLS | kiyaco24.ir | دسترسی امن DNS و میزبان | DNS/TLS، www canonical، renewal و HTTPS |
| تلگرام بات | @kiyaco24bot | توکن **جدید**، webhook secret، chat ID مدیر | getMe تطابق username، webhook، /start، سفارش تست و retry |
| کانال تلگرام | @kiyaco24 | ادمین‌کردن بات با حداقل مجوز post/edit | انتشار محصول تست با اجازه، ثبت messageId، ویرایش موجودی |
| اینستاگرام | @kiyaco24 | API رسمی/شناسه account و مجوز معتبر | pack دستی ابتدا؛ publish رسمی فقط با scope و تأیید |
| پیامک | نام provider نهایی نشده | key + sender/template OTP | ارسال به شمارهٔ تست مالک، rate/cost limit |
| پرداخت | adapter زرین‌پال پیشنهادی | merchant، قرارداد و sandbox/prod | verify سرور و واحد پول، reconciliation و refund |
| رسانه | لوگوها موجود | S3/R2 bucket، credential و domain | upload/scan، public product، private receipt |
| DB/صف/بکاپ | قرارداد Postgres/pg-boss | URL امن و worker و backup service | migration، job dedup، restore آزمایشی |
| ایمیل/Push/AI | اختیاری طبق FULL | provider و key و consent | failure fallback؛ عدم ارسال PII غیرضروری |

## توکن ارسال‌شده در گفتگو
مالک باید در BotFather توکن قبلی را revoke و توکن تازه را فقط در secret manager میزبان وارد کند. این بسته آن را نگهداری/بازنشر نمی‌کند. پاک‌کردن متن یک سند به معنی ابطال credential نیست. هیچ کلید تازه‌ای از مالک در چت مطالبه نشود؛ فقط نام env و مسیر تنظیم امن توضیح داده شود.

## قرارداد ربات و مینی‌اپ
- endpoint `/api/webhooks/telegram`؛ بررسی header `X-Telegram-Bot-Api-Secret-Token` با مقایسهٔ امن، dedup update_id در DB، پاسخ سریع و صف پردازش؛ webhook secret از bot token جداست. امضای HMAC Mini App با webhook header یکی نیست.
- ورودی arbitrary Telegram user id، username یا chat_id دلیل مالکیت سفارش/همکار نیست. اتصال حساب با nonce یک‌بارمصرف کوتاه‌عمر و نشست وب تأییدشده، جلوگیری از account takeover و unlink امن.
- Mini App: اعتبارسنجی server-side initData دقیقاً طبق الگوریتم جاری رسمی Telegram و freshness auth_date با محدودیت پیشنهادی ۵ دقیقه و replay protection؛ initDataUnsafe هرگز اعتماد نشود. بعد اعتبارسنجی session داخلی و OTP برای اطلاعات مالی/همکاری.
- منو `/start`: فروشگاه، سفارش‌های من، پیگیری، پشتیبانی، همکاری؛ گردونه/کیف پول فقط وقتی ماژول فعال و مجاز است. bot به کاربری که شروع نکرده/مجوز نداده پیام خصوصی نمی‌فرستد.
- مالک admin chat ID allowlist؛ فرمان مدیریت مثل تغییر موجودی علاوه بر chat ID باید کارمند linked + MFA/step-up + همان RBAC و approval داشته باشد. هیچ secret/اطلاعات کامل سفارش در کانال عمومی فرستاده نشود.
- channel mirror با ChannelPublication(product/post/channel/messageId/version,status)، outbox و نسخه‌ها؛ timeout ارسال نامشخص → reconciliation/manual review، نه retry کور که پست تکراری بسازد. سفارش مستقل از موفقیت پیام‌رسان است.
- تعرفه‌ها/limits از مستند provider در زمان پیاده‌سازی گرفته شوند، 429 و Retry-After رعایت شود. وضعیت read/open برای تلگرام بدون دادهٔ واقعی ادعا نشود.

## پیکربندی و health واقعی
`.env.example` در ریشهٔ بسته، مقادیر خالی secret دارد. در runtime با Zod سمت سرور validate؛ production با DEMO_MODE یا sandbox ناخواسته fail-fast و feature نا‌آماده disabled شود. env را در client import نکن؛ فقط config عمومی مجاز است.
پنل integrations وضعیت UNCONFIGURED / CONFIGURED / TESTING / HEALTHY / DEGRADED را با lastTestAt و آخرین خطای scrubشده نشان دهد؛ صرف واردکردن key معادل healthy نیست. دکمهٔ «تست اتصال» network call واقعی با permission و audit انجام دهد.

## راه‌اندازی و تأیید
۱) توکن تازه و credentials در میزبان؛ ۲) DB و migration/seed demo جدا؛ ۳) web و worker؛ ۴) storage و private upload؛ ۵) TLS و origin واقعی و preview؛ ۶) provider sandbox و تست end-to-end؛ ۷) ربات/کانال با اجازه؛ ۸) حداقل یک جینِ تأییدشده و pack/قیمت واقعی و owner MFA؛ ۹) صفحات حقوقی/تماس/ارسال/مجوزها؛ ۱۰) backup restore و پایش؛ ۱۱) تست واقعی کم‌مبلغ فقط با اجازهٔ مالک؛ ۱۲) فعال‌سازی تولید و smoke.
برای preview، bind به 0.0.0.0، origin مجاز و URLهای مرورگر relative؛ localhost مرورگر به backend sandbox اشاره نمی‌کند. بدون اجازه DNS یا production data تغییر نده.
