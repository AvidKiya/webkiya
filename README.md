# کیا — KIYA | پروندهٔ ساخت کامل

فروشگاه اجتماعی فارسی با هویت بنفش/طلایی، خرید تکی و عمدهٔ جینی همکاران تأییدشده و پنل حرفه‌ای نقش‌محور.

- **[از اینجا شروع کنید](file/START-HERE.md)**
- [پرامپت کامل ساخت](file/prompts/BUILD-KIYA.md)
- [Skill و دستورکار ایجنت](file/skills/kiya-builder/SKILL.md)
- [قرارداد نهایی مالک](file/docs/14-owner-addendum.md)
- [فهرست کل پرونده](file/README.md)

این مخزن فعلاً بستهٔ مشخصات، لوگو، config عمومی و ماکاپ است؛ اپ/اتصال واقعی سرویس‌ها هنوز ساخته نشده‌اند. برای تحویل کل پوشهٔ `file/` را ارسال کنید. هیچ توکن یا دادهٔ مشتری در بسته قرار نگیرد.

بررسی بسته: `python3 file/scripts/validate_package.py`
آزمون بررسی‌کننده: `python3 -m unittest discover -s file/scripts -p 'test_*.py'`
ساخت ZIP تحویل: `python3 file/scripts/package_handoff.py --output /home/user/KIYA-build-package.zip`
