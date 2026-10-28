# ۱۸ — محدودهٔ FULL و استخراج نیازهای اسناد قدیمی

اسناد تاریخی Markdown و HTML در references/legacy نگهداری شده‌اند. محتوای متنی و فصل‌ها بررسی شدند؛ claimهای «✅ ساخته شد» و «تست شد» به این repo منتقل نشدند. هر دو سند یک مرجع تکمیلی‌اند، نه دو پروژهٔ مستقل. موضوعاتی که در پروندهٔ قبلی کم‌رنگ/نبودند: کیامگ، گردونه، کیف پول عملیاتی، checkout مکالمه‌ای، Mini App و ورود تلگرام، هزینه‌های عمومی، استوری‌ساز و جدول عمده.

## تعهد FULL (ساخت مرحله‌ای، نه حذف)
| شناسه | ماژول / خروجی اجرایی | مرحله | آزمون پذیرش افزوده |
|---|---|---|---|
| F01 | فید و grid ثانویه، پست، کامنت، بیشتر، جست‌وجو، ذخیره، پروفایل و تاریخچهٔ مرور اختیاری | STARTER | UX/CM سند۱۲؛ جست‌وجوی فارسی و فیلتر URL |
| F02 | مشتری OTP، کارکنان MFA، نقش سفارشی/Scope، audit، تعلیق فوری و escalation داخلی | STARTER | RB/SC سند۱۲، ارجاع فقط به گیرندهٔ مجاز |
| F03 | محصول/تنوع/رسانه/size، انبار، قیمت، quote/place، سفارش، return/refund، PDF و برچسب | STARTER | CO/OR/RF/AD سند۱۲، PDF بدون نشت PII |
| F04 | همکار، تأیید پشتیبانی، جین/BOM، سه قیمت، MOQ و سبد جدا | STARTER | WH01 تا WH11 سند۱۵ |
| F05 | CMS درباره/تماس/قوانین/FAQ، بنر و نوار اطلاع‌رسانی و maintenance/order-pause | STARTER | ویرایش→بازبینی→انتشار با audit؛ توقف خرید روی سرور |
| F06 | inbox سایت/تلگرام، پاسخ رسمی، SLA، تخصیص/یادداشت داخلی و گزارش | FULL-A | ownership هر thread، privacy یادداشت، قطع provider مانع سایت نباشد |
| F07 | SocialHub: site + Telegram + pack اینستاگرام، queue/schedule و mirror قیمت/stock | FULL-A | event یک‌بار مؤثر، retry، partial failure؛ قیمت عمده عمومی نشود |
| F08 | استوری چندفریم، زمان‌بندی، seen state، pause/skip و CTA؛ highlight دسته | FULL-A | keyboard/reduced-motion؛ زمان‌بندی server و محصول unpublished مخفی |
| F09 | Mini App، account linking و login تلگرام + tracking امن، منوی ربات | FULL-A | initData جعلی/کهنه رد؛ unlink و nonce replay؛ بدون Telegram خرید کار کند |
| F10 | کیامگ: شماره/آرشیو/section، انتخاب خودکار واقعی و سردبیر، صفحه و تصویر انتشار | FULL-B | draft→preview→publish؛ لینک‌ها و attribution server؛ از آن قیمت عمده نشت نکند |
| F11 | کیف پول ledger، شارژ، پرداخت، اعتبار هدیه/cashback و گزارش | FULL-B | balance غیرمنفی؛ double spend/refund/charge callback تکراری؛ تطبیق ledger |
| F12 | کوپن، کمپین consent، UTM، سبد رهاشده و opt-out؛ ابزار محتوای دستی و AI اختیاری | FULL-B | audience scope، budget cap، revoke consent، عدم وعدهٔ آمار read جعلی |
| F13 | گردونهٔ تبلیغاتی با نسخه قوانین/احتمال/بودجه، یک‌بار روزانه و reward ledger | FULL-B مشروط قانونی | انتخاب server CSPRNG، unique(user,campaign,period)، double reward صفر |
| F14 | مالی با cost snapshot، هزینهٔ عمومی، fee، settlement/reconciliation، CSV/Excel امن | FULL-C | جمع paid/refund/fees با provider تطبیق؛ cost ناقص سود خالص نسازد |
| F15 | import/export امن، content calendar، حساب/آدرس/نشست‌ها، PWA/Push و SEO | FULL-C | dry-run import و rollback batch، CSV injection، cache خصوصی صفر، consent push |
| F16 | CI، deploy/rollback، بکاپ/restore، health و metrics/alerts، راهنمای ادمین و آموزش | FULL-C | OP سند۱۲، restore drill، smoke تولید با اجازه |

## حداقل قرارداد اجرایی برای ماژول‌های افزوده
### کیف پول
WalletAccount + immutable WalletEntry + WalletOperation idempotency + source payment/refund/reward؛ مبالغ اعتبار/بدهی با balance cache قفل‌شده در تراکنش، ledger قابل تطبیق. شارژ فقط با verify درگاه و ref یکتا؛ تغییر دستی با `wallet:credit:request/approve`، دلیل و منع self-approval. جایزه promotional credit از وجه قابل برداشت جدا؛ پیش‌فرض انتقال/برداشت نقدی خاموش و شرایط شفاف. مالیات/مجوز نگهداری وجه باید پیش از فعال‌سازی بررسی شود. مسیرهای `/wallet`، `/api/wallet`، `/api/wallet/topups`، `/api/admin/wallet/adjustments`؛ فقط صاحب کیف/مالی مجاز. ترتیب قفل wallet/order ثابت؛ ترکیب پرداخت کیف + درگاه تنها با قرارداد split tender و تست، برای شروع یک روش در هر attempt.

### گردونه
WheelCampaign/Prize/Spin/RewardGrant با نسخهٔ probability و بودجه؛ no paid wagering، شرط خرید اجباری برای شانس پیش‌فرض ممنوع تا بررسی قانون. یک بار در ۲۴ ساعت rolling بر timestamp سرور (نه صرف تغییر تاریخ محلی). CSPRNG server، unique request و قفل محدودیت؛ جایزه و ثبت مصرف و wallet/coupon grant اتمیک با outbox. جایزهٔ «نقدی» مرجع تاریخی پیش‌فرض اعتبار تبلیغاتی غیرقابل‌برداشت است و با همین عنوان صادقانه نمایش داده شود؛ تغییر نیازمند تأیید. odds و شرایط/انقضا روشن؛ budget تمام شود campaign توقف و پیام مشخص. بدون تأیید حقوقی feature OFF؛ animation فقط نتیجهٔ قطعی server را نمایش دهد. `/wheel` و `/api/wheel/spins`؛ rate limit و anti-abuse، نه ادعای تقلب‌ناپذیری مطلق.

### کیامگ و استوری
MagIssue(slug,number,status,scheduledAt,publishedAt)، MagSection، MagItem با ترتیب و snapshot محتوا؛ قیمت در سایت از منبع زندهٔ مجاز، قیمت در خروجی انتشار snapshot تاریخ‌دار و لینک قیمت جاری. Post/StoryFrame links به محتوای منتشرشده، زمان اعتبار و رسانه دارای حقوق استفاده. تولید «پرفروش» از سفارش پرداختی واقعی منهای برگشت و window تعریف‌شده، نه شمارهٔ ساختگی. `/mag`، `/mag/[slug]`، `/admin/mag`، `/admin/stories`؛ `mag:manage/publish` و `story:manage` با audit. expiry استوری از سرور حتی با cache؛ AI فقط draft با تأیید انسان.

### checkout مکالمه‌ای و ربات
Conversational UI یک front-end روی همان quote/order domain، نگهداری draft server و امکان ویرایش مراحل؛ fallback فرم و keyboard، مسیر پیشرفت قابل فهم. از کاربر OTP/شماره کارت/پرداخت داخل chat عمومی نخواه. ربات کاربر را به HTTPS checkout رسمی هدایت کند؛ اگر خرید درون‌ربات ساخته شد، همان سفارش/idempotency/price scope و سیاست Telegram payment جاری رعایت شود، نه ذخیرهٔ جداگانهٔ سبد مالی بدون مالکیت.

### مالی/انتساب/import
Expense(category,amount,date,attachment private)، GatewaySettlement و ReconciliationItem؛ گزارش تسویه از فروش جدا، اجازهٔ finance:read و export محدود. UTM و content attribution مدل مشخص last non-direct click با پنجرهٔ پیشنهادی ۷روز و consent لازم؛ درآمد خرید فقط از order.paid server و اصلاح refund، نه اعتماد به event client. import فایل با schema/سقف/scan و dry-run و error report، batch id، audit و approval قیمت/stock؛ تغییرات مخرب نیاز تأیید.

## مسیرهای alias و عدم تعارض
- `/shop` اصلی grid ثانویه؛ `/store` → `/shop`.
- `/profile` → `/@kiyaco24`؛ `/direct` → `/inbox`؛ `/admin/direct` → `/admin/inbox`؛ `/admin/logs` → `/admin/audit`.
- `/track` فرم OTP/auth و سپس `/orders/[code]`؛ دانستن code مجوز نیست. `/login` → `/auth/login`.
- `/admin/social`، `/admin/mag`، `/admin/marketing`، `/admin/stories` routes واقعی با feature gate؛ alias حفظ backlink در صورت مهاجرت.

## خارج از FULL و وابستگی‌های مشروط
مارکت‌پلیس/چندفروشنده/ارزان‌ترین‌یاب و امتیاز فروشنده خارج‌اند. اپ بومی، چندزبان، اعتبار/اقساط، live، جست‌وجوی تصویری/صوتی، پیش‌بینی انبار، چندانبار، loyalty پیشرفته و کانال باسلام/دیجی‌کالا optional-future در backlog با تصمیم مالک‌اند. Instagram auto-publish، مقررات کیف/گردونه و کالاهای محدود مشروط‌اند؛ سازنده ماژول/آداپتور و حالت disabled واقعی تحویل می‌دهد ولی حق جعل اتصال/مجوز ندارد. ویژگی‌های اختیاری را خودسرانه به هزینه و دامنهٔ FULL اضافه نکن.

## خروجی نهایی FULL
کد تمام F01..F16، migration/seed، DTO/API، role catalog تست‌شده، UI روشن/تیره، responsive، tests و CI، env و health setup، runbooks، راهنمای کار با پنل، accessibility/performance report و traceability با شواهد. هر feature مشروط با علت/نیاز/مسئول و دکمهٔ disabled توضیح‌دار ثبت شود؛ محدودیت‌ها نباید پشت موفقیت جعلی پنهان شوند. تحقق ۱۰۰۰ سفارش/۵دقیقه هدف آزمون اختیاری طرح تاریخی است و بدون بارسنجی تعهد ظرفیت محسوب نمی‌شود.
