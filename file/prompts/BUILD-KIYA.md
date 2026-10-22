# پرامپت مادر حرفه‌ای — ساخت کامل فروشگاه کیا

متن زیر را با **کل پوشه** به ایجنت سازنده بده. ارسال این فایل به‌تنهایی تصاویر، قراردادها و کلیدهای سرویس را تأمین نمی‌کند.

```text
نقش تو: تیم ارشد محصول، UX/UI، full-stack، امنیت، QA و DevOps پروژهٔ «کیا — KIYA».
هدف: این وب‌سایت را واقعاً بساز، نه اینکه فقط سند، پیشنهاد یا دمو دکمه‌نما تحویل بدهی.
ورودی: تمام این بستهٔ مشخصات و تصاویر. repo را ابتدا inventory کن؛ اگر کد موجود است بدون تحلیل بازنویسی نکن. این بسته در زمان تهیه فقط اسناد و ماکاپ داشته و ادعای تکمیل تاریخی اثبات کد فعلی نیست.

خواندن به ترتیب:
START-HERE.md و AGENTS.md؛ docs/14-owner-addendum.md تا docs/18-full-scope-and-legacy-map.md؛ skills/kiya-builder/SKILL.md؛ docs/00 و 10/11/12؛ سپس اسناد 01..08، decisions، config، tokens، previewها، screenshotها و references/legacy.
اولویت: آخرین دستور صریح مالک، اصلاحیه 14..18، قراردادهای اجرایی، اسناد پایه، مرجع تاریخی و ماکاپ.

قطعیات:
برند کیا — KIYA، دامنه https://kiyaco24.ir، bot @kiyaco24bot، Telegram/Instagram @kiyaco24. تک‌فروشنده، نه marketplace. فارسی/RTL، تومان، نمایش جلالی، موبایل/دسکتاپ و روشن/تیره. رنگ بنفش+طلایی با لوگوهای واقعی assets/brand و tokens جدید؛ نام‌های Vitrin/InstaStore و صورتی برند قدیمی در محصول نهایی نباشد.
تجربه فید اجتماعی با هویت مستقل، استوری و اکسپلور، پست قابل خرید، مودال deep-link و Back صحیح، بیشتر/کمتر قابل دسترس، کامنت پایدار واقعی و پاسخ یک‌سطحی، لایک/ذخیره و نشان خرید سروری. اطلاعات خرید دقیق ولی نه کپی برند/پوسته دیجی‌کالا.

عمده الزام هسته است:
مشتری عادی تکی بخرد و قیمت عمده را «تماس بگیرید/پیام به پشتیبانی» ببیند. فقط PartnerAccount APPROVED با scope معتبر قیمت واحد عمده، جین و واحد خرده را ببیند. پشتیبان دارای permission مستقل حساب همکار را تأیید کند؛ همکار ادمین نیست. خرید عمده با pack/جین و تعداد جین، ترکیب SKU نسخه‌دار و MOQ ردیف/سفارش/مبلغ قابل تنظیم؛ ۱۲ را hardcode نکن. سبدها و سفارش‌های تکی/عمده جدا، انبار SKU مشترک و رزرو اتمیک. قیمت عمده از HTML/RSC/JSON/SEO/CDN/social/cache عمومی نشت نکند. حداقل خرید دقیقاً یک جین است؛ minPacksPerLine=1، minOrderPacks=1، packStep=1؛ بدون حداقل مبلغ یا حداقل واحد اضافه. سند۱۵ و WH01..WH11 قرارداد الزامی است.

محدوده تحویل FULL سند۱۸ F01..F16:
هسته فروش/کاربر/پست/کامنت/همکار، پنل حرفه‌ای با نقش و Scope و Audit و MFA، محصول/انبار/سفارش/مرجوعی/بازپرداخت/مالی/مشتری/CMS، SocialHub و queue/schedule، تلگرام و Mini App/linking، inbox، story builder، کیامگ، کیف پول ledger، کوپن/کمپین/UTM، گردونهٔ قانونی با بودجه و شرایط، import/export و calendar، PWA/SEO، CI/observability/backup/restore/deploy و آموزش پنل. ترتیب STARTER→FULL-A→FULL-B→FULL-C راه اجرای پروژه است، نه مجوز توقف پس از MVP. هیچ نیاز را بی‌صدا حذف نکن؛ featureهای مشروط و optional طبق سند۱۸ جدا ثبت شوند.

معماری:
Next.js App Router/React سازگار و نسخهٔ پایدار پشتیبانی‌شده، TS strict، Tailwind build محلی، Postgres و Prisma، Zod، Vitest/Playwright و pg-boss worker مستقل مبنای پیشنهادی. نسخه‌ها را pin و ADR کن. Workers/D1 در سند قدیمی با این معماری یکسان نیست؛ انتخاب آن نیاز بازطراحی و آزمون مالی دارد. ERD کامل، schema runnable، SQL constraints، migration و seed demo تحویل بده؛ schema ناقص داخل Markdown را آماده فرض نکن.
پول Decimal تومان و string در API، adapter ریال/تومان صریح. تراکنش کوتاه، قفل/رزرو، idempotency اجباری پول، outbox، callback verify سرور، دیررس/UNKNOWN و reconciliation، snapshot سفارش و BOM. wallet/refund/coupon نباید دوباره اثر کنند یا موجودی/اعتبار منفی بدهند.

امنیت:
مشتری با ownership و session/OTP، کارکنان MFA+permission+Scope؛ فقط OWNER نقش می‌دهد. approve همکار مجوز جدا. هر mutation حساس audit هم‌تراکنشی. اسرار فقط env سرور، secret خام در پنل/response/log/client/Git ممنوع. توکن قبلی افشاشده و باید عوض شود؛ از آن استفاده نکن و از مالک نخواه کلید جدید را در چت بفرستد. فایل .env.example placeholder است. اتصال واقعی DNS/Meta/SMS/درگاه/ربات نیاز credentials و اجازه دارد. تا آن زمان health را BLOCKED/UNCONFIGURED و feature را امن و صادقانه غیرفعال نگه دار، نه موفقیت جعلی.
امکانات فروش دخانی/نیکوتینی از جمله پاد/ویپ/سالت خارج از محدودهٔ این ساخت است؛ گردونه و wallet نیز مقررات و سیاست تأییدشده می‌خواهند. هیچ badge اعتماد جعلی و آمار ساختگی production نساز.

روش اجرا:
1) اول خلاصه برداشت، scope manifest نیاز→route/service/table/permission/test، ابهامات مسدودکننده، ERD و برنامهٔ مراحل را بنویس. فقط ابهامات واقعاً حساس را بپرس؛ UI/test را با demo صریح پیش ببر. دامنهٔ قطعی: لباس معمولی نداریم، لباس زیر داریم؛ دوباره این تصمیم را ابهام تلقی نکن.
2) همان مرحلهٔ نخست را کدنویسی کن؛ فقط برنامه نده. vertical sliceهای تست‌پذیر بساز و مراحل را تا FULL ادامه بده. اگر ابزار/نوبت محدود است خروجی موجود و گام بعد دقیق بده؛ ادعای اتمام نکن.
3) کامنت و پست واقعی و عمده را قبل تزئین تمام پنل به انتها تست کن. همهٔ صفحه‌ها Loading/Empty/Error/Partial/Offline؛ AA، focus، keyboard، reduced-motion؛ viewportهای 360/390/768/1024/1440 و dark/light.
4) تست‌های واقعی unit/integration/Postgres concurrency/e2e/build و CI را اجرا کن؛ فقط تست‌های mock کافی نیست. report با IDهای سند۱۲، WH و F و شواهد؛ اجرا‌نشده را صریح اعلام کن.
5) برای هر stage فهرست فایل، migration، env لازم بدون secret، دستور/خروجی تست، DONE/BLOCKED، تصمیم‌ها و ادامه را گزارش کن. docs/decisions و traceability را بروز کن.
6) قبل production، تست sandbox مالی، revoke/session/cache leak، restore drill، health، حقوق/ارسال/مرجوعی و آزمون کم‌مبلغ با اجازه. DNS، اعلان انبوه یا پرداخت واقعی را بدون اجازه اجرا نکن.

تحویل نهایی:
کد کامل و lockfile، schema/migrations/seeds، API قرارداد، tests و CI، env.example امن، deployment web+worker، runbook rollback/restore/incident، راهنمای ادمین و نقش‌ها/عمده، گزارش mobile+desktop/dark+light/accessibility/performance و جدول نیازهای پاس‌شده/مسدود. هیچ راه خرید/عملیات مالی در production با alert/localStorage/mock شبیه‌سازی نشود. یک skill یا prompt نمی‌تواند جای credentials، مجوز و شواهد runtime را بگیرد؛ کیفیت نتیجه را با این معیارها ثابت کن.
اکنون inventory، برنامه و اجرای مرحلهٔ نخست را آغاز کن.
```
