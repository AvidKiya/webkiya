# ۱۵ — خرید تکی، عمدهٔ جینی و حساب همکار

الزام هستهٔ STARTER و FULL. هدف: مشتری عادی مثل همیشه تکی بخرد؛ همکار پس از تأیید همان فروشگاه را با حالت عمده و قیمت اختصاصی ببیند. همکار مجوز پنل ادمین ندارد.

## ۱. هویت همکار و گردش تأیید
- Customer با PartnerAccount مستقل: NONE → PENDING → APPROVED / REJECTED؛ APPROVED → SUSPENDED / EXPIRED؛ درخواست مجدد طبق سیاست. صرف tag «همکار» مجوز نیست.
- مسیرهای `/account/partner` برای وضعیت/درخواست، `/wholesale` ویترین عمده، `/admin/partners` صف پشتیبانی، `/admin/wholesale` قیمت/جین/قواعد.
- درخواست: نام/موبایل OTP شده، نام کسب‌وکار و شهر، روش تماس، توضیح همکاری؛ مدارک تنها در صورت ضرورت با consent و storage خصوصی. شماره به‌تنهایی اثبات کسب‌وکار نیست.
- نقش پیش‌فرض SUPPORT مجوزهای همکاری را دارد، اما OWNER می‌تواند هرکدام را حذف کند: `partner:read` برای صف؛ `partner:review` برای پرونده/یادداشت/رد با دلیل؛ `partner:approve` برای تأیید واقعی؛ `partner:suspend` برای تعلیق. این مجوزها جدا seed شوند؛ review به‌تنهایی approve یا suspend نمی‌دهد.
- هیچ کارکنانی حساب مشتری متعلق به خودش را تأیید نکند؛ owner approval جایگزین با audit. وضعیت، علت، actor، approvedAt/expiresAt و policyVersion ثبت شوند. تمدید و اعلان رد/تأیید/تعلیق با outbox.
- پیش‌فرض پیشنهادی اعتبار بدون تاریخ انقضا تا تعلیق مالک؛ اگر مالک expiry تعیین کرد، guard آن در هر درخواست مؤثر باشد. حداقل خرید به تصمیم نهایی مالک یک جین است؛ حداقل مبلغ اضافه نداریم. تعداد واحدهای داخل بسته از مشخصات واقعی کالا می‌آید.

## ۲. چه کسی چه قیمتی می‌بیند؟
| مخاطب | قیمت تکی عمومی | قیمت واحد عمده/جین | اقدام عمده |
|---|---|---|---|
| ناشناس / مشتری عادی | برای RETAIL/BOTH مجاز | **مخفی** | تماس بگیرید / پیام به پشتیبانی / درخواست همکاری |
| PENDING / REJECTED / SUSPENDED / EXPIRED | مثل مشتری عادی | **مخفی** | وضعیت همکاری + تماس؛ عدم خرید عمده |
| APPROVED در محدودهٔ کالا/لیست قیمت | قیمت خرده در کنار مقایسه | هر سه: واحد عمده، جین، تکی سایت | انتخاب جین و تعداد جین؛ افزودن به سبد عمده |
| APPROVED خارج scope یا بدون قیمت معتبر | فقط خرده در صورت مجاز | مخفی | استعلام قیمت؛ هرگز صفر تومان |

- «تماس بگیرید» برای **قیمت عمده** است؛ نباید قیمت تکی کالاهای قابل خرید عمومی را پنهان کند. WHOLESALE_ONLY برای عموم بدون قیمت و بدون خرید تکی نمایش داده شود.
- حتی همکار برای کالا با `priceMode=INQUIRY` قیمت عمده نمی‌بیند؛ درخواست استعلام. اگر SKU خرده فعال است قیمت تکی مستقل معتبر است.
- حالت retail/wholesale در UI انتخاب می‌شود؛ تغییر mode در client هیچ مجوزی نمی‌دهد. revoke بلافاصله صفحه/quote/add/place را محدود کند؛ سفارش پرداخت‌شدهٔ قبلی و snapshot آن معتبر و در تاریخچهٔ صاحبش قابل مشاهده است.
- پاسخ بدون مجوز اصلاً فیلد wholesalePrice نداشته باشد؛ نه null همراه اطلاعات قابل استنتاج. جلوگیری از نشت در SSR/RSC/Next data/prefetch/API/cache/search/JSON-LD/sitemap/OG/CSV/استوری/تلگرام/اینستا/کیامگ. خروجی عمومی SocialHub فقط قیمت خرده یا استعلام؛ پیام همکار خصوصی opt-in مجاز.

## ۳. جین و بسته
«جین» لزوماً ۱۲ عدد نیست. مدل PackDefinition با id، productId، label، unitsPerPack مثبت، version، active و اجزای PackComponent(variantId, units)؛ مجموع units = unitsPerPack. تنظیم واقعی هر کالا قبل انتشار الزامی است.
- FIXED_ASSORTMENT: ترکیب رنگ/سایز ثابت و قابل دیدن؛ خرید N جین یعنی ضرب BOM در N. مثال دمو فقط: ۶ واحد (۳×مشکی M، ۳×مشکی L)؛ این مثال تنظیم واقعی محصول نیست.
- HOMOGENEOUS: هر جین فقط یک تنوع، بسته با همان variant لینک می‌شود. MIX_AND_MATCH فقط اگر مالک فعال کند و حداقل/سقف هر رنگ/سایز و جمع صحیح سمت سرور کنترل شود؛ برای شروع پیش‌فرض خاموش.
- UI به‌جای stepper تک‌عدد، pack selector و `تعداد جین` integer؛ ترکیب، مجموع تعداد، قیمت واحد عمده، قیمت جین و قیمت واحد تکی هم‌زمان. امکان کسری جین ممنوع مگر pack کوچک مستقل تعریف شود.
- `minPacksPerLine`، `packStep`، `minOrderUnits`، `minOrderAmount` و scope تجمیع سفارش تنظیمات مستقل‌اند. پیش‌فرض تأییدشده: `minPacksPerLine=1`، `minOrderPacks=1`، `packStep=1`، `minOrderUnits=null` (بدون حد مستقل) و `minOrderAmountToman="0"` (بدون حد مبلغ). یک جین کافی است؛ نه دو/سه جین و نه حداقل مبلغ پنهان. فعال‌سازی خرید واقعی فقط پس از درج قیمت و Pack واقعی و آزمون پرداخت است.
- اول حداقل هر ردیف و مضرب جین، سپس حداقل سفارش کنترل شود. minOrderAmount روی subtotal عمده پس از تخفیف کالا و پیش از ارسال/مالیات (بدون coupon) سنجیده شود؛ هر تغییر این تعریف version policy می‌خواهد.

## ۴. قیمت‌گذاری و صورت‌حساب
- WholesalePriceList و PriceEntry(scope partner/group/category، variant/pack، validFrom/To، priceMode، unitPriceToman). تخفیف پله‌ای بر مبنای تعداد جین با بازه‌های بدون overlap و `minPacks`، اولویت قطعی و version.
- ترتیب انتخاب: لیست اختصاصی فعال همکار → گروه فعال → عمومی همکار؛ بیش از یک match هم‌اولویت خطای تنظیمات است نه انتخاب تصادفی. قیمت منقضی = استعلام، نه fallback به قیمت حساس دیگران.
- بستهٔ هم‌قیمت: packPrice = unitPrice × unitsPerPack، line = packPrice × packCount. بسته با قیمت متنوع: packPrice = مجموع(unitPrice هر جزء × units آن). واحد میانگین فقط «میانگین هر عدد» و با نمایش اجزا؛ فاکتور با مبالغ اجزا، نه گردکردن میانگین ضرب‌شده.
- قیمت نمایشی تکی سایت برای مقایسه از retail snapshot جاری؛ اگر خرده ندارد «فروش تکی ندارد» نه صفر. unitPrice عمده نباید بی‌صدا از retail درصدی گرفته شود مگر قاعدهٔ صریح نسخه‌دار مالک.
- Coupon/B2C، گردونه، cashback و ارسال رایگان خرده پیش‌فرض روی عمده اعمال نمی‌شوند؛ policy مستقلی با OWNER و آزمون stacking لازم است. مالیات/ارسال بر واحد و وزن واقعی اقلام محاسبه شود.
- سبد retail و wholesale جدا، checkout و سفارش جدا؛ مشترک‌بودن session مجاز، مخلوط‌کردن دو قیمت در یک سفارش V1 ممنوع. تعویض mode سبد دیگر را حذف نکند.

## ۵. انبار و سفارش
- موجودی فیزیکی مشترک per SKU؛ انبار عمده جدا و غیرواقعی ایجاد نکن. حداکثر بستهٔ قابل‌فروش FIXED = min(floor(availableSku/componentQty))؛ عدد نمایش فقط راهنما، تخصیص نهایی اتمیک.
- quote عمده: account approved + scope + pack/policy/price versions + BOM + stock + حداقل‌ها دوباره محاسبه شود. place همه را مجدد بررسی کند و قفل SKUها با ترتیب id.
- ذخیرهٔ Order.salesMode، partnerId، priceListVersion، policyVersion، packSnapshot، packCount، units و component lines و unitPrice/cost؛ تغییر pack بعداً سفارش قدیمی را تغییر ندهد.
- لغو/expiry به اندازهٔ component units رزرو آزاد کند؛ refund/return هر قلم طبق snapshot. پیش‌فرض درخواست مرجوعی جین کامل؛ معیوب جزئی مسیر رسیدگی مجزا با qty SKU و تأیید، نه اجبار حذف حقوق قانونی مشتری.
- تعلیق پیش از place: 403 PARTNER_NOT_APPROVED. تعلیق پس از place پیش از پرداخت: intentهای pending از طریق job/guard لغو و رزرو آزاد؛ اگر پرداخت در مسابقه تأیید شد PAYMENT_REVIEW با تسویه/استرداد طبق سند ۱۰، نه پول گمشده. سفارش PAID قبلی همچنان انجام یا با refund رسمی لغو شود.

## ۶. داده، API و مجوز
جدول‌ها: PartnerAccount(userId unique,status,version,reviewer,reason,...), PartnerApplication، PartnerStatusEvent، WholesalePolicy(version,status,limits)، WholesalePriceList، PartnerPriceListAssignment، WholesalePriceEntry، WholesalePriceTier، PackDefinition(version)، PackComponent، QuoteRequest/QuoteResponse (برای استعلام مدت‌دار، نه دورزدن APPROVED).
قیود: CHECK مقادیر مثبت و min<=max؛ FK و index status/user/validity؛ pack component variant متعلق به همان محصول؛ version optimistic lock و unique business key. تغییر تأیید یا قیمت = audit/outbox.

| API | کنترل |
|---|---|
| GET/POST /api/partner/application | مشتری فقط پروندهٔ خودش، idempotency و rate limit |
| GET /api/wholesale/catalog و /products/:id | APPROVED و scope؛ DTO private,no-store |
| POST /api/wholesale/inquiries | مشتری/مهمان با کنترل spam، محصول/pack و context، بدون انتشار اطلاعات مشتری |
| POST /api/wholesale/quote و /place | approved، policy/price versions، idempotency place، component reservation |
| /api/admin/partners/:id/approve یا /reject | partner:approve / partner:review مطابق عمل + Scope + علت و audit |
| /api/admin/partners/:id/suspend | partner:suspend + audit و revoke intents |
| /api/admin/wholesale/prices و /packs و /policies | wholesale:price:manage / wholesale:pack:manage / wholesale:policy:manage |

خطاها: PARTNER_NOT_APPROVED، PARTNER_SCOPE_DENIED، WHOLESALE_INQUIRY_REQUIRED، MIN_PACKS_NOT_MET، PACK_STEP_INVALID، MIN_ORDER_NOT_MET، PACK_CHANGED، WHOLESALE_PRICE_CHANGED؛ پیام فارسی با حداقل و مقدار باقی‌مانده بدون نشت قیمت به غیرمجاز.

## ۷. آزمون‌های P0 افزوده
WH01: ناشناس و pending از HTML/RSC/JSON/cache/OG/SocialHub قیمت عمده استخراج نکنند.
WH02: SUPPORT بدون approve permission رد شود؛ حساب خودش را نتواند تأیید کند؛ با مجوز، audit و اعلان ایجاد شود.
WH03: همکار معتبر هر سه قیمت را ببیند؛ پله/تاریخ/لیست معتبر درست انتخاب شود.
WH04: جین ۶ و ۱۲ و ترکیبی، ۲ جین، واحد و قیمت و وزن واقعی را درست محاسبه کنند؛ کسری/مضرب نامعتبر رد.
WH05: MOQ ردیف و سفارش مستقل؛ bypass با request مستقیم ناموفق.
WH06: آخرین SKU میان مشتری تکی و همکار هم‌زمان رقابت کنند؛ oversell و double-release صفر.
WH07: تغییر قیمت/pack/تعلیق بین quote و place، 409/403؛ پرداخت دیررس رسیدگی‌شده.
WH08: cache دو همکار با price list متفاوت، logout و account switch هیچ نشت ندهد.
WH09: refund/return پس از تغییر pack و قیمت از snapshot؛ paid قدیمی پس تعلیق باقی بماند.
WH10: inquiry-only، منقضی و بدون قیمت «پیام به پشتیبانی» بدهند نه صفر/خرید ناخواسته.


WH11 (P0): همکار APPROVED با یک جین موجود و قیمت معتبر مجاز به ثبت سفارش عمده باشد؛ هیچ حداقل مبلغ یا تعداد جین اضافی مانع نشود. صفر یا کسری جین رد شود. یک جین ارزان نیز همان حق خرید را دارد. این آزمون برای جین‌های با تعداد واحد متفاوت اجرا شود.
