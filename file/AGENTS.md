# AGENTS.md — KIYA delivery rules

این فایل راهنمای ایجنتی است که این پوشه را برای ساخت دریافت می‌کند؛ در صورت انتقال بسته به ریشهٔ پروژه، مسیرها را مطابق همان ریشه resolve کن.

1. نام نهایی برند **کیا — KIYA**، دامنه kiyaco24.ir. نام‌های Vitrin/InstaStore صرفاً تاریخی‌اند.
2. اول START-HERE، docs/14، skill و پرامپت BUILD-KIYA را بخوان. آخرین دستور مالک > docs/14 تا 18 > docs/00،10،11 > اسناد قدیمی > مراجع تاریخی/عکس.
3. هدف قرارداد FULL است؛ ساخت مرحله‌ای برای کنترل ریسک است نه حذف قابلیت‌ها. حالت STARTER فقط با درخواست صریح مالک خروجی نهایی می‌شود.
4. بدون بررسی repo برنامهٔ موجود را بازنویسی نکن. این بسته فعلاً app ندارد؛ در repo میزبان ابتدا inventory و نسخه‌های پشتیبانی‌شده را ثبت کن.
5. auth مشتری = session/OTP/ownership؛ auth کارکنان = MFA + permission + Scope؛ اعطای نقش فقط OWNER. همکار Role اداری نیست.
6. قیمت عمده فقط سرور و برای همکار APPROVED. در HTML، RSC، JSON، CDN، SEO، analytics، سوشال و export عمومی نشت نکند. انقضا/تعلیق در quote و place دوباره بررسی شود.
7. خرید جینی با PackDefinition و BOM و واحد واقعی موجودی؛ عدد ۱۲ را hardcode نکن. stock/reserved، پرداخت، کوپن، کیف پول و بازپرداخت اتمیک و idempotent.
8. پول Decimal تومان؛ در API رشته. provider amount را adapter با واحد صریح تبدیل کند؛ float ممنوع.
9. هر mutation حساس + audit در همان transaction؛ eventها با outbox بعد commit. تأیید حساس مستقل، بدون self-approval.
10. هیچ token، password، PII یا secret را در Git، prompt، URL، client یا log نگذار. env.example فقط placeholder؛ توکن قبلاً افشاشده باید تعویض شود.
11. Tailwind build محلی، فونت self-host، UI فارسی/RTL، تم روشن/تیره، AA و reduced-motion. لوگو اصلی را تحریف نکن.
12. هر feature واقعی loading/empty/error/offline و acceptance test؛ alert/toast به‌تنهایی backend نیست. mock فقط در demo با برچسب و هرگز production.
13. migration + seed ساختگی + schema validation و تست PostgreSQL واقعی؛ ادعای قدیمی D1 با Prisma/Postgres یک معماری واحد نیست. تغییر زیرساخت فقط ADR و بازطراحی تراکنش‌ها.
14. تغییرات مرحله‌ای، lint/typecheck/unit/integration/e2e/build و security checks. دستور اجرا‌نشده را موفق گزارش نکن. از ادعای امنیت مطلق/تقلب‌ناپذیری/ظرفیت بی‌تست پرهیز کن.
15. متن حقوقی draft علامت بخورد؛ کالاهای وابسته به مجوز و گردونه تا تأیید قانونی خاموش. هیچ نشان اعتماد جعلی نساز.
16. در پایان هر مرحله report شامل file list، تست و خروجی، traceability، unresolved dependencies و مرحلهٔ بعد؛ ادامه تا هدف FULL یا مانع خارجی دقیق. بدون اجازه DNS، پرداخت واقعی، ارسال انبوه و deploy مخرب نکن.

17. تصمیم نهایی مالک: لباس معمولی EXCLUDED و لباس زیر داخل کاتالوگ است. امکانات فروش محصولات دخانی/نیکوتینی خارج از محدودهٔ ساخت‌اند.
