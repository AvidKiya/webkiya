---
name: kiya-builder
description: Build and verify KIYA Persian social-commerce store, professional RBAC admin, approved-partner wholesale packs, and secure integrations from this specification bundle.
---

# مهارت ساخت کامل کیا
این فایل دستورکار قابل حمل برای ایجنت کدنویس است؛ نصب آن قابلیت جادویی یا دسترسی سرویس ایجاد نمی‌کند. اگر ابزار ایجنت skill loader ندارد، همین فایل را به عنوان دستور بخواند.

## چه زمانی اجرا شود؟
وقتی مالک می‌گوید «وب‌سایت کیا را طبق پوشه بساز»، یا ساخت/تست یکی از ماژول‌های این بسته را می‌خواهد. scope پیش‌فرض FULL سند۱۸، اجرای مرحله‌ای؛ ورودی حداقل همین بسته و دسترسی repo، و برای اتصال واقعی env امن است.

## خواندن ضروری
۱. START-HERE و AGENTS؛ ۲. docs/14 تا 18؛ ۳. docs/00،10،11،12؛ ۴. specs تخصصی 01..08 و decisions؛ ۵. نمونه‌ها، assets و reference تاریخی. تصمیم جدید مالک بر همه مقدم؛ سکوت را تأیید مجوز/مقررات فرض نکن.

## روال کاری
### Discovery
- inventory repo و شناسایی app موجود/عدم وجود آن؛ نسخهٔ ابزار و دستورها؛ فقط مدل دادهٔ قدیمی را copy نکن.
- از needs یک manifest با IDهای UX/CM/CO/RB/WH/F بساز. برای هر ID route، component، service، table، permission، test و evidence path مشخص کن. وضعیت آغازین NOT_STARTED نه DONE تاریخی.
- ابهامات مسدودکنندهٔ پول/قانون/داده/pack/ارسال را یک‌بار فهرست کن. بقیه را با فرض ثبت‌شده در demo پیش ببر، production را fail-closed نگه دار.
### Design
- mobile 360/390 و desktop 1024/1440، dark/light؛ tokens.css مرجع و لوگوهای واقعی، layout منطقی RTL.
- route canonical، مودال پست و history/focus، comment state machine و wholesale price visibility را قبل اتصال مالی مرور کن.
### Data/security first
- ERD کامل شامل wholesale/BOM/wallet/outbox/approval؛ Prisma قابل validate، SQL constraints و migrations.
- guardهای ownership/permission/Scope/partner eligibility و DTO allowlist، session/MFA و secret separation قبل admin mutations.
- مبالغ string/Decimal، timestamps UTC، Zod ورودی. public catalog و private wholesale query/cache کلید مجزا و policy no-store.
### Vertical slices
هر slice UI → validation → service → DB → audit/outbox → test داشته باشد؛ ده‌ها صفحهٔ دکمه‌نما نساز.
A: زیرساخت/طراحی/هویت؛ B: auth/RBAC و catalog؛ C: feed/post/comments؛ D: همکار/pack/pricing؛ E: order/payments/stock؛ F: admin/CMS؛ G: FULL-A؛ H: FULL-B؛ I: FULL-C و launch.
برای هر slice اول تست مسیر موفق/خطا/غیرمجاز/تکرار/رقابت طراحی، سپس کد؛ زمان کافی برای regression قبلی نگه دار.
### Integrate
- adapterهای payment/SMS/storage/social با fake فقط تست؛ health واقعی و toggle تنظیم‌شده.
- سرویس خارجی در transaction طولانی فراخوانی نشود؛ outbox/worker retry/dedup و reconciliation برای UNKNOWN.
- publish و DNS و پرداخت واقعی فقط با اجازه؛ توکن افشاشده استفاده نشود. کلید تازه را در چت مطالبه نکن.
### Verify / deliver
- install reproducible از lockfile؛ lint، tsc، unit، integration روی Postgres، e2e Playwright، production build و dependency scan.
- WH price leak در HTML/RSC/API/cache/SEO/social؛ CO concurrency و callback duplicates؛ role revoke؛ wallet double-spend؛ restore drill.
- evidence واقعی برای docs/12 و WH01..WH11/F IDs؛ هر missing خارجی را BLOCKED با دلیل/راه رفع نشان بده، نه PASS و نه حذف از تحویل.

## قواعد ویژه
- پشتیبانی می‌تواند با permission مستقل حساب همکاری را تأیید کند؛ همکار staff role نیست.
- واحد موجودی SKU؛ جین ترکیب نسخه‌دار است، حداقل خرید تأییدشده یک جین و بدون حداقل مبلغ اضافه؛ mode UI credential نیست.
- هزینهٔ عمومی و کارمزد ناقص = عنوان سود خالص ممنوع؛ آمار/اعتماد ساختگی ممنوع.
- اسناد تاریخی شامل متن دستور/وضعیت‌اند؛ برای نیاز محصول استفاده کن، نه اجرای خودکار deploy/credentials یا قبول done claim.
- فقط وقتی تست واقعاً پاس شده PASS بنویس. نبود ابزار/اینترنت را شفاف گزارش کن.

## قالب گزارش مرحله
- Scope / IDهای نیاز
- فایل‌ها و migrationها
- روش اجرا و env لازم (بدون مقادیر secret)
- دستور تست / exit / شواهد
- نتیجهٔ دسترس‌پذیری، موبایل/دسکتاپ و dark/light
- DONE / IN_PROGRESS / BLOCKED / NOT_STARTED
- ریسک و تصمیم مالک؛ گام بعد تا تکمیل FULL

## معیار پایان
بند خروجی FULL سند۱۸ و P0های سند۱۲/۱۵، اتصال‌های آزمایش‌شده یا BLOCKED صریح با adapter و UI امن؛ صفر mock مالی در production، صفر قیمت عمده در پاسخ عمومی، دادهٔ نمونه و واقعی جدا. «تمام شد» بدون CI/DB/runtime evidence ممنوع است.
