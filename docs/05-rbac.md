# ۰۵ — نقش‌بندی و کنترل دسترسی (RBAC/ABAC)

> **به‌روزرسانی مالک:** [اصلاحیهٔ کیا](14-owner-addendum.md) و اسناد ۱۵ تا ۱۸ مقدم‌اند: برند KIYA، بنفش/طلایی، عمده در هسته و هدف نهایی FULL. نام‌ها/فازهای قبلی در این فایل تاریخی‌اند.

> **اصلاحیهٔ اجرایی 2026-10-22:** [قرارداد مرجع](00-execution-contract.md) و اسناد ۰۹ تا ۱۳ بر جزئیات متعارض این سند مقدم‌اند. این فایل مشخصات است، نه اثبات پیاده‌سازی.

> هدف کارفرما: «ادمین‌ها را بتوانم نقش‌بندی کنم و دسترسی محدود بدهم به آن‌ها برای انجام کارهای سایت.»
> این سند قرارداد امنیتی پروژه است. **هیچ صفحه یا API بدون عبور از این لایه ساخته نمی‌شود.**

---

## ۱. مدل: RBAC + ABAC + Scope

سه لایه روی هم:

1. **RBAC** — نقش به کاربر، مجوز به نقش (`permission` با فرمت `resource:action`).
2. **ABAC** — شرط‌های پویا: `owner`, `ownDepartment`, `amount < X`, `category in [...]`, `status in [...]`.
3. **Scope (محدودهٔ داده)** — کاربر می‌تواند محدود شود به: همهٔ داده‌ها، دسته‌های خاص، شهر/شعبه، یا فقط رکوردهای تخصیص‌یافته به خودش.

```
User ─┬─ UserRole ─ Role ─ RolePermission ─ Permission
      ├─ ScopeGrant (category[] | city[] | assignedOnly | allData)
      └─ Session (device, ip, expiresAt, mfa)
```

**قواعد غیرقابل‌شکست:**
- مجوزها **جمع‌شونده** (union) هستند؛ هیچ نقش «منفی» وجود ندارد. برای محدودکردن، مجوز را نده.
- `OWNER` تنها نقشی است که می‌تواند نقش بسازد و بدهد.
- کاربر نمی‌تواند نقش خودش را تغییر دهد یا مجوزی بالاتر از خودش بدهد (Privilege Escalation Guard).
- حداقل یک `OWNER` فعال باید همیشه باقی بماند (guard روی حذف/تعلیق).
- تغییر نقش/مجوز بلافاصله در نشست‌های فعال اثر می‌کند (نسخه‌بندی `permissionVersion` در session؛ نشست با نسخهٔ قدیمی → revalidate یا خروج).

---

## ۲. نقش‌های پیش‌فرض

| کلید | نام | توضیح | دادهٔ مجاز |
|---|---|---|---|
| `OWNER` | مالک فروشگاه | همه‌چیز، تنها نقش حساس | همه |
| `ADMIN` | مدیر فروشگاه | عملیات فروشگاه؛ بدون نقش‌دهی، انتقال مالکیت، حذف فروشگاه و مشاهدهٔ secret خام | طبق Scope |
| `MANAGER` | مدیر عملیات | سفارش، انبار، مشتری، پشتیبانی؛ بدون تنظیمات زیرساخت | همه |
| `CONTENT` | مدیر محتوا و سوشال | محصولات، پست، کالکشن، کامپوزر | همه (محتوا) |
| `PRODUCT` | کارشناس محصول | افزودن/ویرایش محصول؛ بدون قیمت | دسته‌های تخصیصی |
| `WAREHOUSE` | انباردار | موجودی، آماده‌سازی و ارسال سفارش | انبار تخصیصی |
| `SUPPORT` | پشتیبان | دایرکت، سفارش (خواندن)، مشتری (محدود) | گفت‌وگوهای تخصیصی |
| `FINANCE` | مالی | تراکنش، فاکتور، بازپرداخت (با تأیید)، گزارش | همه (مالی) |
| `MARKETER` | بازاریاب | کمپین، کوپن، سگمنت، تحلیل | همه (بدون PII کامل) |
| `AUDITOR` | بازرس | فقط خواندن + لاگ‌ها | همه (read-only) |

نقش‌ها **قابل ساخت** هستند؛ می‌توان مثلاً «پشتیبان ارشد» با مجوز `order:refund:request` ساخت.

---

## ۳. فهرست مجوزها (Permission Catalog)

فرمت: `resource:action[:qualifier]`؛ مقادیر دقیق catalog ملاک‌اند و wildcard نمایشی مجوز اجرایی نیست.

### محصولات
`product:read` · `product:create` · `product:update` · `product:delete` · `product:archive` · `product:publish` · `product:price:read` · `product:price:update` · `product:cost:read` (هزینهٔ تمام‌شده) · `product:bulk_update` · `product:import` · `product:export`

### تنوع و انبار
`variant:manage` · `stock:read` · `stock:adjust` · `stock:reserve` · `stock:count` (انبارگردانی) · `stock:count:approve` · `stock:transfer` · `supplier:manage`

### سفارش‌ها
`order:read` · `order:read:pii` (دیدن شمارهٔ کامل و آدرس) · `order:create_manual` · `order:update_status` · `order:cancel` · `order:refund:request` · `order:refund:approve` · `order:note:write` · `order:invoice:print` · `order:export` · `order:assign`

### مشتریان
`customer:read` · `customer:pii:read` · `customer:update` · `customer:delete` · `customer:segment:create` · `customer:wallet:credit` · `customer:wallet:credit:approve` · `customer:export`

### محتوا و اجتماعی
`post:read` · `post:create` · `post:update` · `post:delete` · `post:publish` · `post:schedule` · `collection:manage` · `story:manage` · `comment:read` · `comment:reply` · `comment:pin` · `comment:delete` · `comment:moderate` · `media:upload` · `ugc:moderate`

### پشتیبانی
`inbox:read` · `inbox:reply` · `inbox:assign` · `inbox:close` · `inbox:canned_reply:manage` · `inbox:transcript:export`

### مالی
`finance:read` · `transaction:read` · `invoice:manage` · `refund:execute` · `gateway:configure` · `report:financial:export` · `pricing:rule:manage`

### بازاریابی
`campaign:read` · `campaign:create` · `campaign:send` · `campaign:delete` · `coupon:read` · `coupon:create` · `coupon:approve` · `segment:manage` · `broadcast:telegram`

### سیستم و دسترسی
`settings:read` · `settings:update` · `settings:secrets:read` · `settings:secrets:update` · `staff:read` · `staff:invite` · `staff:update` · `staff:suspend` · `role:read` · `role:create` · `role:update` · `role:assign` · `audit:read` · `audit:export` · `backup:manage` · `integration:manage` · `store:delete`

**تعداد مجموع: ~۹۰ مجوز** — کافی برای کنترل دقیق، کم‌اندازه برای مدیریت.

---

## ۴. ماتریس نقش × مجوز (خلاصه)

| مجوز | OWNER | ADMIN | MANAGER | CONTENT | PRODUCT | WAREHOUSE | SUPPORT | FINANCE | MARKETER | AUDITOR |
|---|---|---|---|---|---|---|---|---|---|---|
| product:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| product:create/update | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| product:delete | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| product:price:update | ✓ | ✓ | — | — | — | — | — | — | — | — |
| stock:adjust | ✓ | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| stock:count:approve | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| order:read | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | — | ✓ |
| order:read:pii | ✓ | ✓ | ✓ | — | — | ✓(ارسال) | ✓ | ✓ | — | — |
| order:update_status | ✓ | ✓ | ✓ | — | — | ✓(ارسال/تحویل) | — | — | — | — |
| order:refund:request | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | — | — |
| order:refund:approve | ✓ | ✓ | — | — | — | — | — | ✓ | — | — |
| customer:read | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓(بدون PII) | ✓ |
| customer:pii:read | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | — | — |
| post:create/publish | ✓ | ✓ | ✓ | ✓ | — | — | — | — | ✓ | — |
| comment:reply/pin | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | — | — | — |
| inbox:reply | ✓ | ✓ | ✓ | — | — | — | ✓ | — | — | — |
| finance:read | ✓ | ✓ | ✓ | — | — | — | — | ✓ | ✓(محدود) | ✓ |
| refund:execute | ✓ | ✓ | — | — | — | — | — | ✓ | — | — |
| campaign:send | ✓ | ✓ | — | — | — | — | — | — | ✓ | — |
| coupon:create | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | — |
| settings:update | ✓ | ✓ | — | — | — | — | — | — | — | — |
| settings:secrets:* | ✓ | ✓ | — | — | — | — | — | — | — | — |
| staff:read/invite/update/suspend | ✓ | ✓(بدون نقش‌دهی) | — | — | — | — | — | — | — | — |
| role:create/update/assign | ✓ | — | — | — | — | — | — | — | — | — |
| audit:read | ✓ | ✓ | ✓ | — | — | — | — | ✓ | — | ✓ |
| store:delete | ✓ | — | — | — | — | — | — | — | — | — |

---

## ۵. قواعد ویژهٔ کسب‌وکار (Business Guards)

این‌ها در لایهٔ سرویس اجرا می‌شوند، نه فقط UI:

| عمل | شرط |
|---|---|
| تغییر قیمت بیش از **۱۵٪** در ۲۴ ساعت | نیازمند درخواست تأیید تغییر قیمت → مجوز `product:price:update` + **تأیید دوم** از نقش بالاتر (4-eye) |
| حذف محصول دارای سفارش | ممنوع؛ فقط `archive` |
| بازپرداخت بیش از **۵٬۰۰۰٬۰۰۰ تومان** | نیازمند دو تأییدکنندهٔ مستقل |
| اصلاح موجودی بیش از **±۱۰۰** | نیازمند نقش `MANAGER` و ثبت `note` |
| صدور کوپن بیش از **۵۰٪** | نیازمند `coupon:approve` |
| ارسال کمپین به بیش از **۱۰٬۰۰۰** نفر | نیازمند تأیید مدیر و پنجرهٔ ارسال |
| دیدن شمارهٔ کامل مشتری | مجوز `customer:pii:read` + ثبت در `PiiAccessLog` |
| خروجی گرفتن داده | مجوز `*:export` + ثبت حجم و هدف در لاگ |
| تغییر تنظیمات درگاه/تلگرام | `settings:secrets:update` + 2FA |
| تغییر نقش کاربر | `role:assign` + جلوگیری از ارتقای سطح + 2FA |

---

## ۶. پیاده‌سازی (Next.js + Prisma)

### ۶.۱ منبع مجوز

```ts
// src/lib/auth/permissions.ts
export const PERMISSIONS = [
  "product:read", "product:create", /* ... */
] as const;
export type Permission = typeof PERMISSIONS[number];

export function can(session: Session, perm: Permission, ctx?: AbacContext): boolean {
  if (!session.roles.some(r => r.permissions.includes(perm))) return false;
  return ctx ? checkAbac(session, perm, ctx) : true;
}
```

### ۶.۲ ابزارهای استاندارد

```ts
// مسیر سرور: src/server/guard.ts
export async function requirePermission(perm: Permission, ctx?: AbacContext) { ... }  // throw 403
export async function requireScope(resource: ScopeResource, id: string) { ... }      // بررسی مالکیت/دسته
```

- **Server Actions و Route Handlers:** همه با `requirePermission` شروع می‌شوند.
- **خواندن داده:** به‌جای `where: {}` از `scopedWhere(session, 'product')` استفاده می‌شود تا فیلتر Scope اعمال شود.
- **کلاینت:** یک کامپوننت `<Gate perm="product:delete">…</Gate>` برای پنهان‌کردن UI (فقط تجربهٔ کاربری؛ امنیت روی سرور است).
- **خروجی API:** هرگز فیلدهای حساس را بیدلیل serialize نکن؛ از `select` صریح استفاده کن.

### ۶.۳ میان‌افزار

```
┌ Request ──► auth middleware (session)
│              └─► 2FA gate (نقش‌های حساس در صورت فعال‌سازی)
│                    └─► rate limit (per-user + per-IP)
│                          └─► requirePermission
│                                └─► zod validate
│                                      └─► prisma transaction { mutate + audit }
└ ◄── response
```

### ۶.۴ ثبت لاگ (Audit)

```ts
await audit({
  actorId, action: "order:refund:approve", resource: "Order", resourceId,
  before: { status: "REFUND_REQUESTED" },
  after:  { status: "REFUNDED" },
  ip, userAgent, requestId,
});
```
هر `audit` در **همان تراکنش** تغییر داده نوشته می‌شود تا لاگ ناقص نماند. جدول `AuditLog` فقط append-only (بدون update/delete).

---

## ۷. نقش‌های DIY — تجربهٔ ساخت نقش در پنل

1. «نقش جدید» → نام + توضیح + کپی از نقش موجود (اختیاری).
2. درخت مجوزها با جست‌وجو و چک‌باکس سه‌حالته (همه/برخی/هیچ).
3. تعیین Scope: «همهٔ دسته‌ها» / «فقط دسته‌های انتخابی» (درخت) / «فقط رکوردهای تخصیص‌یافته».
4. **پیش‌نمایش:** «این نقش این منوها را می‌بیند» + لیست URLs مجاز.
5. ذخیره → صفحهٔ نقش: تاریخچهٔ تغییر، تعداد کاربران، دکمهٔ «آزمایش با کاربر نمونه».
6. تخصیص به کاربر → اعلان به کاربر + ورود اجباری جدید برای اعمال مجوزها.

---

## ۸. امنیت حساب

- OTP برای ادمین‌ها یا رمز + 2FA؟ **هر دو:** `role` حساس ⇒ 2FA اجباری (TOTP + کد پشتیبان).
- سیاست رمز: حداقل ۱۰ کاراکتر، بررسی لیست رمزهای لو‌رفته (`haveibeenpwned` k-anonymity).
- قفل موقت پس از ۵ تلاش ناموفق (۱۵ دقیقه) + اعلان.
- نشست: HttpOnly + Secure + SameSite=Lax، عمر ۸ ساعت برای ادمین، چرخش refresh.
- IP allowlist اختیاری برای نقش OWNER.
- CASL-style read-only impersonation برای دیباگ، با لاگ کامل.
- تفکیک محیط: `SANDBOX` mode در تنظیمات، با نوار هشدار در بالای پنل «حالت تست — تراکنش‌های واقعی نیست».

---

## ۹. تست‌های اجباری RBAC

| تست | انتظار |
|---|---|
| SUPPORT روی `POST /api/admin/products` | 403 |
| WAREHOUSE روی `stock:adjust` | 200 + AuditLog |
| WAREHOUSE روی `product:price:update` | 403 |
| PRODUCT با Scope دستهٔ A، ویرایش محصول دستهٔ B | 403 |
| MANAGER دوبار بازپرداخت > ۵M | رد تا تأیید دوم |
| حذف آخرین OWNER | 409 |
| ارتقای خود به OWNER | 403 |
| استفادهٔ نشست قدیمی پس از تغییر نقش | revalidate اجباری |
| درخواست PII بدون مجوز | 403 + no data leak در پاسخ |
| Brute-force روی ورود ادمین | قفل پس از ۵ تلاش |

هر تست در CI اجرا می‌شود؛ یک اسکریپت `rbac-matrix.test.ts` تمام ترکیب «نقش × اندپوینت» را می‌سازد.
