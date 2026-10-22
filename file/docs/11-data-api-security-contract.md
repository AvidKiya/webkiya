# ۱۱ — تکمیل مدل داده، API و امنیت

> **به‌روزرسانی مالک:** [اصلاحیهٔ کیا](14-owner-addendum.md) و اسناد ۱۵ تا ۱۸ مقدم‌اند: برند KIYA، بنفش/طلایی، عمده در هسته و هدف نهایی FULL. نام‌ها/فازهای قبلی در این فایل تاریخی‌اند.

این قرارداد جایگزین ادعای «schema کامل» در ۰۶ است؛ مدل‌های آن سند فقط نقطهٔ شروع‌اند. سازنده باید schema.prisma، migrationهای SQL، seed و آزمون constraint تحویل دهد. تا `prisma validate` و migration روی DB خالی و fixture قدیمی پاس نشده، مدل قابل اجرا تأیید نشده است.

## شکاف‌های مدل و الزام تکمیل
| موجودیت | فیلدها / قیود حداقلی |
|---|---|
| Reservation / ReservationItem | orderId، variantId، qty مثبت، expiresAt، ACTIVE/CONSUMED/EXPIRED/RELEASED، زمان مصرف؛ unique(orderId, variantId)؛ index(status,expiresAt) |
| PaymentAttempt | orderId، provider، amountToman، amountGateway، currency، authority، refId، state، requestKey، timestamps؛ unique(provider,authority)، unique(provider,refId) برای مقادیر non-null |
| IdempotencyRecord | actor/cart identity، route، key، requestHash، status، response امن، expiresAt؛ unique(identity,route,key) |
| CouponRedemption | couponId، orderId، userId، RESERVED/CONSUMED/RELEASED، expiresAt؛ unique(couponId,orderId)؛ شمارش قفل‌شدهٔ per-user و سراسری |
| ApprovalRequest / ApprovalDecision | requesterId، action، resourceId، resourceVersion، payloadHash، expiry، status؛ decision با unique(requestId,approverId) و منع self-approval |
| ReturnRequest / ReturnItem | orderId، userId، وضعیت، دلیل، orderItemId و qty؛ قید جمع تعداد برگشتی حداکثر تعداد خریدشده |
| Refund | paymentAttemptId، returnId اختیاری، amount، status، providerRef، idempotencyKey یکتا، approverها و خطاهای sanitizeشده |
| Shipment / ShipmentItem | orderId، carrier، trackingCode، shippedAt/deliveredAt، orderItemId و qty |
| OutboxEvent / DeliveryAttempt | aggregateId، eventId یکتا، payloadVersion، payload امن، status، availableAt، retryCount؛ unique(eventId,channel,recipient) برای delivery |
| MediaAsset | ownerId، objectKey یکتا، purpose، mime تأییدشده، bytes، dimensions، scanStatus، visibility، createdAt؛ private asset با URL امضاشده کوتاه‌عمر |
| OtpChallenge | phoneNormalized، codeHash، expiresAt، attemptCount، consumedAt، purpose و throttling؛ OTP و phone خام در log ممنوع |
| StaffInvite | email/phone، roleهای پیشنهادی، tokenHash یکتا، expiresAt، acceptedAt، inviter؛ پذیرش یک‌بار و permission check مجدد |
| Follow / NotificationPreference / Consent | customer/store رابطه یکتا؛ preference به تفکیک channel/topic؛ رضایت با زمان/منبع/version و revoke |
| DailyStat | dateUTC یا businessDate Tehran صریح، dimensions، عدد و نسخهٔ محاسبه؛ دادهٔ cache نه سند مالی |

### اصلاحات موجودیت‌های فعلی
- CollectionItem: `id` مستقل اجباری؛ CHECK دقیقاً یکی از postId/productId غیر null؛ دو partial unique روی `(collectionId,postId)` و `(collectionId,productId)` برای non-nullها. FKها و روابط معکوس را اضافه کن. nullable در compound primary key مجاز نیست.
- SaveItem: همان XOR و unique جزئی برای userId/postId یا userId/productId. کلید نباید هدف خالی بپذیرد.
- Comment: clientMutationId + unique(userId,clientMutationId)، verifiedOrderItemId اختیاری؛ پاسخ root از همان پست با service guard و تست؛ CommentReport unique(commentId,reporterId). وضعیت و intent enum شوند.
- موجودی: CHECK stock>=0 و reserved>=0 و reserved<=stock؛ qty سبد/سفارش/رزرو>0؛ ledger append-only و FK variantId؛ سفارش دارای کالا حذف cascade نشود.
- OrderItem: نام، SKU، options، unitPrice، lineDiscount، tax، shipping allocation، costAtSale و qty در لحظهٔ خرید snapshot؛ تغییر محصول سفارش تاریخی را تغییر ندهد.
- Session و نقش‌ها: permissionVersion نقش‌ها و کاربر، ابطال آنی، tokenHash؛ RoleKey شامل OWNER است نه SUPER_ADMIN مبهم. نقش سیستمی کلید یکتا و نام سفارشی یکتا در فروشگاه.
- ScopeGrant پیش‌فرض `allData=false`؛ Scope فعال و قابل تست، assigned user و category resource واقعی، نه فقط آرایه‌ای بدون guard.
- Address، Bookmark و روابط معکوس به‌صورت کامل validate شوند؛ زمان‌های کسب‌وکار `@db.Timestamptz(3)` نه اتکا به DateTime پیش‌فرض.
- permission و enumهای status در یک catalog تایپ‌شده؛ wildcardهای نمایشی جدول مستقیماً در DB seed نشوند. همهٔ مجوزهای حدود ۹۰تایی واقعاً فهرست و تست شوند.
- Settings عمومی از secrets جدا؛ rawPayload درگاه تنها فیلدهای allowlist و بدون اطلاعات حساس، TTL و دسترسی محدود داشته باشد.

## API مرجع V1
REST JSON با `/api`؛ پنل `/api/admin`. موفقیت `{ok:true,data,requestId}` و خطا `{ok:false,error:{code,message,fields?},requestId}`؛ status HTTP واقعی. GET عملیات مالی را تغییر ندهد، جز callback خارجی با verify کنترل‌شده و adapter مستند.

| مسیر / روش | مجوز / رفتار |
|---|---|
| GET /feed و /posts/:id | عمومی، فقط PUBLISHED و محصول مجاز؛ cursor غیرقابل اتکا به عنوان auth نیست |
| GET /posts/:id/comments | عمومی VISIBLE، scope پست؛ sort/limit allowlist |
| POST /posts/:id/comments | مشتری authenticated، clientMutationId الزامی، 201 یا نتیجهٔ قبلی |
| PATCH/DELETE /comments/:id | مالک یا moderator با ثبت دلیل؛ version برای تعارض |
| PUT/DELETE /comments/:id/like و /posts/:id/like | مشتری authenticated، idempotent |
| POST /comments/:id/report | مشتری، تکرار بی‌اثر، بدون افشای reporter به عموم |
| GET /cart، POST /cart/items، PATCH/DELETE /cart/items/:id | guest cookie یا مشتری؛ server ownership، qty محدود |
| POST /checkout/quote | سبد خود شخص؛ quote مالی کوتاه‌عمر، نه رزرو قطعی |
| POST /checkout/place | OTP verified، Idempotency-Key اجباری، رزرو اتمیک |
| POST /payments/:attemptId/start | مالک سفارش، retry key ثابت؛ بدون دریافت مبلغ از client |
| GET/POST /payments/callback/:provider | مطابق قرارداد provider؛ verify server-to-server؛ request کاربر به‌تنهایی PAID نسازد |
| GET /orders و /orders/:code | authenticated و userId مالک؛ کد سفارش credential نیست |
| POST /orders/:code/returns | مالک، اقلام/مهلت مجاز، idempotent |
| POST /auth/otp/request و /verify | rate limit، challenge کوتاه‌عمر، پاسخ request بدون افشای وجود حساب |
| POST /auth/logout | revoke نشست و cookie، CSRF |
| GET /notifications و PATCH /notifications/:id/read | مشتری، فقط دادهٔ خود؛ ناشناس 401 نه اعلان عمومی |
| GET/POST /inbox/* | در V1.1 فقط مالک thread یا پشتیبان scoped؛ یادداشت داخلی هرگز به مشتری نرسد |
| GET /events/stream | session/cookie امن و authorization هر topic؛ عدم پذیرش channel دلخواه client |
| /admin/* | permission دقیق + Scope + allowlist field در ورودی/خروجی + Audit mutation |

خطاهای اضافه: PRICE_CHANGED، RESERVATION_EXPIRED، APPROVAL_REQUIRED، STALE_VERSION، PAYMENT_REVIEW. 401 ورود، 403 منع، 404 برای منابع دیگران در مسیر مشتری، 409 تعارض، 422 اعتبارسنجی، 429 نرخ. صفحه‌بندی حداکثر ۱۰۰ برای پنل و ۵۰ عمومی؛ sort و filter از allowlist و query پارامتری.

## امنیت غیرقابل مذاکره
- کوکی HttpOnly/Secure/SameSite، چرخش session بعد ورود، CSRF و Origin check روی mutation؛ CORS محدود، هیچ bearer در localStorage یا URL. لینک پیگیری مهمان در صورت نیاز آینده با token hash کوتاه‌عمر و exchange به cookie؛ token از URL حذف و Referrer-Policy سخت اعمال شود.
- API و HTML حساب/سبد/checkout/پنل `private,no-store`؛ Service Worker فقط asset و محتوای عمومی، نه PII، response مالی یا admin. تغییر کاربر cache خصوصی را پاک کند.
- OTP پیشنهادی: عمر ۲ دقیقه، حداکثر ۵ تلاش، resend حداقل ۶۰ ثانیه؛ محدودیت ترکیبی phone/IP/device و کنترل هزینهٔ SMS؛ اعداد قابل تنظیم با audit. درخواست موفق به معنی تحویل پیامک نیست.
- آپلود: بررسی magic bytes + MIME + اندازه، decode/re-encode تصویر، حذف EXIF، نام تصادفی، منع SVG/HTML فعال؛ لینک private برای رسید و پیوست پشتیبانی. SSRF در import URL با allowlist و منع IP داخلی.
- secret در secret manager/env سرور؛ پنل فقط وضعیت configured و چند حرف آخر، نه خواندن مجدد مقدار. settings:secrets:read فقط metadata، نه متن secret. logها scrub، هیچ کارت بانکی کامل یا OTP ثبت نشود.
- CSP، HSTS پس از آماده‌شدن TLS، dependency audit، جلوگیری از CSV formula injection (`=,+,-,@`)، export کوتاه‌عمر با check مجدد مجوز در دانلود و audit تعداد رکورد.
- SSE با heartbeat، reconnect محدود، Last-Event-ID و dedup، قطع در revoke؛ fallback polling با backoff. worker jobها at-least-once، handler idempotent، DLQ و retry دستی audited.
- عمومی بودن comment به معنی عمومی بودن User نیست؛ DTO فقط نام عمومی/آواتار، بدون phone/email/role/آدرس/سفارش. منابع pinned/deleted نیز مجوز مستقل را رعایت کنند.

## صحت و سند اجرایی مورد انتظار
migration باید FK، CHECK، unique و index را واقعاً بسازد؛ اگر Prisma یک قید را بیان نمی‌کند migration SQL لازم است. تست transaction و concurrency روی PostgreSQL واقعی نه فقط mock اجرا شود. سازنده OpenAPI یا schemaهای Zod و مجموعهٔ نمونهٔ request/response بدون دادهٔ واقعی تحویل دهد.
