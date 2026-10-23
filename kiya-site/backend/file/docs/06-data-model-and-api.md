# ۰۶ — مدل داده، API و رویدادها

> **به‌روزرسانی مالک:** [اصلاحیهٔ کیا](14-owner-addendum.md) و اسناد ۱۵ تا ۱۸ مقدم‌اند: برند KIYA، بنفش/طلایی، عمده در هسته و هدف نهایی FULL. نام‌ها/فازهای قبلی در این فایل تاریخی‌اند.

> **اصلاحیهٔ اجرایی 2026-10-22:** [قرارداد مرجع](00-execution-contract.md) و اسناد ۰۹ تا ۱۳ بر جزئیات متعارض این سند مقدم‌اند. این فایل مشخصات است، نه اثبات پیاده‌سازی.

## ۱. نمای کلی

- **DB:** PostgreSQL 15+ (Neon/Supabase) · ORM: Prisma · جداول با `id` (cuid)، `createdAt`، `updatedAt`، و در صورت نیاز `deletedAt` (soft delete).
- **پول:** `Decimal(14,0)` برای تومان (بدون اعشار) — یا `BigInt` تومان. **هرگز float.**
- **زمان:** `timestamptz` ذخیره، نمایش با `Asia/Tehran` و تقویم جلالی.
- **چندفروشندگی (فاز ۳):** در V1 تک‌فروشنده هستیم؛ schema زیر storeId سراسری ندارد و آمادهٔ چندمستأجری نیست. چندفروشندگی در V3 با طرح و تست مستقل است.

---

## ۲. طرح اولیهٔ Prisma (غیرقابل استفادهٔ مستقیم؛ تکمیل طبق سند ۱۱)

```prisma
// ─────────────── هویت و دسترسی ───────────────
enum UserType { CUSTOMER STAFF }
enum RoleKey  { OWNER ADMIN MANAGER CONTENT PRODUCT WAREHOUSE SUPPORT FINANCE MARKETER AUDITOR CUSTOM }

model User {
  id            String   @id @default(cuid())
  type          UserType @default(CUSTOMER)
  phone         String?  @unique          // خریداران با OTP
  username      String?  @unique          // کارکنان
  passwordHash  String?
  fullName      String?
  avatarUrl     String?
  locale        String   @default("fa-IR")
  isActive      Boolean  @default(true)
  isVerified    Boolean  @default(false)  // موبایل تأیید شده
  twoFactorSecret String?                 // رمزنگاری‌شده
  twoFactorEnabled Boolean @default(false)
  telegramChatId  String?
  permissionVersion Int   @default(1)     // برای invalidate نشست
  lastLoginAt   DateTime?
  roles         UserRole[]
  scope         ScopeGrant?
  addresses     Address[]
  orders        Order[]
  comments      Comment[]
  likes         Like[]
  sessions      Session[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Role {
  id          String @id @default(cuid())
  key         RoleKey @default(CUSTOM)
  name        String              // فارسی، قابل‌ویرایش برای نقش‌های CUSTOM
  description String?
  isSystem    Boolean @default(false) // نقش‌های پیش‌فرض غیرقابل‌حذف
  permissions RolePermission[]
  users       UserRole[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model RolePermission {
  roleId     String
  permission String             // "product:update" — از PERMISSION catalog
  role       Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@id([roleId, permission])
  @@index([permission])
}

model UserRole {
  userId String
  roleId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@id([userId, roleId])
}

model ScopeGrant {              // محدودهٔ دادهٔ کاربر
  id           String  @id @default(cuid())
  userId       String  @unique
  allData      Boolean @default(false)
  assignedOnly Boolean @default(false)   // فقط رکوردهای تخصیص‌یافته
  categories   String[] @default([])     // شناسهٔ دسته‌های مجاز
  cities       String[] @default([])
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  userAgent String?
  ip        String?
  permissionVersion Int
  expiresAt DateTime
  revokedAt DateTime?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  actorName  String?
  action     String              // "product:update"
  resource   String
  resourceId String?
  before     Json?
  after      Json?
  ip         String?
  userAgent  String?
  requestId  String?
  createdAt  DateTime @default(now())
  @@index([resource, resourceId])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}

model PiiAccessLog {            // هر بار دیدن شمارهٔ کامل/آدرس
  id         String @id @default(cuid())
  actorId    String
  customerId String
  field      String
  reason     String?
  createdAt  DateTime @default(now())
  @@index([customerId, createdAt])
}

// ─────────────── کاتالوگ ───────────────
enum ProductStatus { DRAFT ACTIVE ARCHIVED OUT_OF_STOCK }

model Category {
  id       String  @id @default(cuid())
  parentId String?
  name     String
  slug     String  @unique
  coverUrl String?
  order    Int     @default(0)
  parent   Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  products ProductCategory[]
}

model Brand { id String @id @default(cuid()) name String slug String @unique logoUrl String? products Product[] }

model Product {
  id            String @id @default(cuid())
  slug          String @unique
  name          String
  shortDesc     String   @db.VarChar(240)
  description   String?  @db.Text
  brandId       String?
  status        ProductStatus @default(DRAFT)
  price         Decimal @db.Decimal(14,0)
  comparePrice  Decimal? @db.Decimal(14,0)
  costPrice     Decimal? @db.Decimal(14,0)     // حساس: نیازمند مجوز
  taxRate       Decimal @default(0) @db.Decimal(5,2)
  weightGram    Int?
  dimensions    Json?                            // {l,w,h}
  isPhysical    Boolean @default(true)
  allowBackorder Boolean @default(false)
  lowStockThreshold Int @default(5)
  tags          String[] @default([])
  seoTitle      String?
  seoDescription String?
  ogImageUrl    String?
  publishedAt   DateTime?
  // آمار denormalized برای فید (به‌روزرسانی با event)
  likeCount     Int @default(0)
  commentCount  Int @default(0)
  soldCount     Int @default(0)
  viewCount     Int @default(0)
  ratingAvg     Decimal @default(0) @db.Decimal(3,2)
  ratingCount   Int @default(0)
  images        ProductImage[]
  variants      Variant[]
  categories    ProductCategory[]
  brand         Brand? @relation(fields: [brandId], references: [id])
  posts         PostProduct[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  @@index([status, publishedAt])
  @@index([likeCount])
}

model ProductImage {
  id        String @id @default(cuid())
  productId String
  url       String
  alt       String?
  width     Int?
  height    Int?
  blurhash  String?
  order     Int    @default(0)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@index([productId, order])
}

model ProductCategory {
  productId  String
  categoryId String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  @@id([productId, categoryId])
}

model Variant {
  id         String @id @default(cuid())
  productId  String
  sku        String @unique
  barcode    String?
  title      String                  // "مشکی / M"
  options    Json                    // { color: "مشکی", size: "M" }
  price      Decimal? @db.Decimal(14,0)   // null = از محصول
  comparePrice Decimal? @db.Decimal(14,0)
  stock      Int @default(0)          // موجودی فیزیکی
  reserved   Int @default(0)          // رزرو شده در سبد/پرداخت
  imageUrl   String?
  isActive   Boolean @default(true)
  product    Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  cartItems  CartItem[]
  orderItems OrderItem[]
  @@index([productId])
}

model StockMove {
  id        String @id @default(cuid())
  variantId String
  reason    String   // SALE | RETURN | MANUAL | DAMAGE | TRANSFER | COUNT | CANCEL
  delta     Int
  before    Int
  after     Int
  note      String?
  actorId   String?
  refId     String?  // orderId یا countSessionId
  createdAt DateTime @default(now())
  @@index([variantId, createdAt])
}

model StockCountSession {
  id        String @id @default(cuid())
  status    String @default("OPEN")  // OPEN | SUBMITTED | APPROVED
  actorId   String
  approverId String?
  items     StockCountItem[]
  createdAt DateTime @default(now())
}

model StockCountItem {
  id        String @id @default(cuid())
  sessionId String
  variantId String
  expected  Int
  counted   Int
  diff      Int
  session   StockCountSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

// ─────────────── محتوا / اجتماعی ───────────────
enum PostType { PRODUCT LOOKBOOK COLLECTION UGC VIDEO }

model Post {
  id         String @id @default(cuid())
  type       PostType @default(PRODUCT)
  title      String?
  caption    String  @db.Text
  media      PostMedia[]
  authorId   String
  storeName  String?                 // برای UGC
  status     String  @default("PUBLISHED") // DRAFT | SCHEDULED | PUBLISHED | HIDDEN
  scheduledAt DateTime?
  publishedAt DateTime?
  pinned     Boolean @default(false)
  allowComments Boolean @default(true)
  likeCount  Int @default(0)
  commentCount Int @default(0)
  shareCount Int @default(0)
  saveCount  Int @default(0)
  products   PostProduct[]
  comments   Comment[]
  likes      Like[]
  createdAt  DateTime @default(now())
  @@index([status, publishedAt])
}

model PostMedia {
  id     String @id @default(cuid())
  postId String
  type   String @default("IMAGE")   // IMAGE | VIDEO
  url    String
  posterUrl String?
  width  Int?
  height Int?
  blurhash String?
  order  Int @default(0)
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
}

model PostProduct {
  postId    String
  productId String
  primary   Boolean @default(false)
  x         Decimal? @db.Decimal(5,2)  // مختصات تگ روی تصویر (درصد)
  y         Decimal? @db.Decimal(5,2)
  post      Post    @relation(fields: [postId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@id([postId, productId])
}

model Collection {                    // کالکشن / دراپ / هایلایت
  id        String @id @default(cuid())
  slug      String @unique
  title     String
  coverUrl  String?
  kind      String @default("COLLECTION") // STORY | COLLECTION | SALE | HIGHLIGHT
  startsAt  DateTime?
  endsAt    DateTime?
  isActive  Boolean @default(true)
  order     Int @default(0)
  items     CollectionItem[]
}

model CollectionItem {
  id           String @id @default(cuid())
  collectionId String
  postId       String?
  productId    String?
  order        Int @default(0)
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  // XOR target + partial unique indexes must be added via SQL migration (docs/11).
  @@index([collectionId, order])
}

model Comment {
  id          String @id @default(cuid())
  postId      String
  userId      String
  parentId    String?                // ریپلای تخت
  body        String  @db.Text
  intent      String  @default("COMMENT")  // COMMENT | QUESTION
  isPinned    Boolean @default(false)
  isOfficial  Boolean @default(false)      // پاسخ فروشگاه
  isVerifiedPurchase Boolean @default(false)
  status      String  @default("VISIBLE")  // VISIBLE | HIDDEN | DELETED | PENDING
  likeCount   Int @default(0)
  mediaUrl    String?
  editedAt    DateTime?
  reportCount Int @default(0)
  post        Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent      Comment? @relation("Replies", fields: [parentId], references: [id])
  replies     Comment[] @relation("Replies")
  likes       CommentLike[]
  createdAt   DateTime @default(now())
  @@index([postId, status, createdAt])
  @@index([postId, intent])
}

model CommentLike {
  commentId String
  userId    String
  createdAt DateTime @default(now())
  comment   Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  @@id([commentId, userId])
}

model CommentReport {
  id        String @id @default(cuid())
  commentId String
  reporterId String
  reason    String      // SPAM | ABUSE | AD | OFFTOPIC
  note      String?
  status    String @default("OPEN") // OPEN | IGNORED | REMOVED | BANNED
  handledBy String?
  createdAt DateTime @default(now())
}

model Like {
  postId String
  userId String
  createdAt DateTime @default(now())
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([postId, userId])
}

model SaveItem {
  userId String
  postId String?
  productId String?
  createdAt DateTime @default(now())
  @@id([userId, postId, productId])
}

model Follow {
  userId String
  targetType String  // SELLER | COLLECTION
  targetId String
  createdAt DateTime @default(now())
  @@id([userId, targetType, targetId])
}

// ─────────────── سبد و سفارش ───────────────
model Cart {
  id        String @id @default(cuid())
  userId    String?
  guestToken String? @unique
  items     CartItem[]
  couponCode String?
  updatedAt DateTime @updatedAt
}

model CartItem {
  id        String @id @default(cuid())
  cartId    String
  variantId String
  qty       Int
  priceSnapshot Decimal @db.Decimal(14,0)
  cart      Cart @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variant   Variant @relation(fields: [variantId], references: [id])
  @@unique([cartId, variantId])
}

enum OrderStatus { PENDING_PAYMENT PAID PREPARING SHIPPED DELIVERED CANCELLED RETURNED }
enum PaymentMethod { GATEWAY CARD_TO_CARD WALLET COD }
enum PaymentStatus { PENDING AUTHORIZED PAID FAILED REFUNDED PARTIALLY_REFUNDED }

model Order {
  id         String @id @default(cuid())
  code       String @unique          // KIA-671670
  userId     String?
  status     OrderStatus @default(PENDING_PAYMENT)
  customerName String
  phone      String
  email      String?
  address    Json                   // {province, city, postal, line1, receiver, lat?, lng?}
  shippingMethod String
  shippingCost Decimal @db.Decimal(14,0)
  subtotal   Decimal @db.Decimal(14,0)
  discount   Decimal @default(0) @db.Decimal(14,0)
  tax        Decimal @default(0) @db.Decimal(14,0)
  total      Decimal @db.Decimal(14,0)
  couponCode String?
  source     String @default("WEB") // WEB | TELEGRAM | MANUAL
  note       String?
  items      OrderItem[]
  payments   Payment[]
  events     OrderEvent[]
  user       User? @relation(fields: [userId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([status, createdAt])
  @@index([phone])
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  variantId String
  name      String
  variantTitle String
  imageUrl  String?
  qty       Int
  unitPrice Decimal @db.Decimal(14,0)
  costAtSale Decimal? @db.Decimal(14,0)
  order     Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variant   Variant @relation(fields: [variantId], references: [id])
}

model Payment {
  id         String @id @default(cuid())
  orderId    String
  method     PaymentMethod
  status     PaymentStatus @default(PENDING)
  amount     Decimal @db.Decimal(14,0)
  authority  String?      // زرین‌پال authority
  refId      String?
  cardLast4  String?
  receiptUrl String?       // رسید کارت‌به‌کارت
  approvedBy String?
  rawPayload Json?
  order      Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  @@index([status])
}

model OrderEvent {
  id        String @id @default(cuid())
  orderId   String
  type      String            // STATUS_CHANGED | NOTE | PAYMENT | SHIPMENT | REFUND
  fromValue String?
  toValue   String?
  note      String?
  actorId   String?
  order     Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

// ─────────────── بازاریابی / پیام ───────────────
model Coupon {
  id         String @id @default(cuid())
  code       String @unique
  type       String            // PERCENT | FIXED
  value      Decimal @db.Decimal(14,2)
  minSubtotal Decimal? @db.Decimal(14,0)
  maxDiscount Decimal? @db.Decimal(14,0)
  usageLimit Int?
  perUserLimit Int @default(1)
  usedCount  Int @default(0)
  startsAt   DateTime?
  endsAt     DateTime?
  scopes     Json?             // {categories:[], products:[], channels:[]}
  isActive   Boolean @default(true)
  needsApproval Boolean @default(false)
  approvedBy String?
}

model Segment {
  id        String @id @default(cuid())
  name      String
  rules     Json               // {and:[{field,op,value}]}
  size      Int?               // cache
  updatedAt DateTime @updatedAt
}

model Campaign {
  id        String @id @default(cuid())
  name      String
  segmentId String?
  channel   String             // TELEGRAM | PUSH | SMS | EMAIL
  content   Json               // {text, mediaUrl, buttons[]}
  status    String @default("DRAFT") // DRAFT | SCHEDULED | SENDING | SENT | FAILED
  scheduledAt DateTime?
  sentAt    DateTime?
  stats     Json?              // {sent, delivered, clicks, orders, revenue}
  createdBy String
}

model InboxThread {
  id        String @id @default(cuid())
  customerId String?
  guestToken String?
  subject   String?
  status    String @default("OPEN") // OPEN | PENDING | CLOSED
  priority  Int @default(1)
  labels    String[] @default([])
  assigneeId String?
  context   Json?              // {orderId, productId, postId}
  lastMessageAt DateTime @default(now())
  messages  InboxMessage[]
  @@index([status, lastMessageAt])
}

model InboxMessage {
  id        String @id @default(cuid())
  threadId  String
  senderType String  // CUSTOMER | STAFF | BOT
  senderId  String?
  body      String @db.Text
  attachments Json?
  richCards Json?              // [{type:"order", orderId:"..."}]
  seenAt    DateTime?
  thread    InboxThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model Notification {
  id        String @id @default(cuid())
  userId    String?
  type      String  // COMMENT_REPLY | LIKE | ORDER_STATUS | PRICE_DROP | BACK_IN_STOCK
  title     String
  body      String?
  link      String?
  isRead    Boolean @default(false)
  createdAt DateTime @default(now())
  @@index([userId, isRead])
}

model Settings {
  id     String @id @default("singleton")
  data   Json   // همهٔ تنظیمات فروشگاه؛ فیلدهای حساس رمزنگاری‌شده
  version Int @default(1)
}
```

---

## ۳. API

### ۳.۱ اصول
- **REST + Server Actions** برای پنل، **tRPC یا Route Handlers** برای فروشگاه.
- پاسخ استاندارد: `{ ok: true, data }` یا `{ ok: false, error: { code, message, fields? } }`.
- کدهای خطا: `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `RATE_LIMITED`, `OUT_OF_STOCK`, `PAYMENT_FAILED`, `CONFLICT`.
- همهٔ مسیرهای نوشتاری: rate limit؛ Idempotency-Key برای سفارش/پرداخت/بازپرداخت اجباری و clientMutationId برای کامنت.

### ۳.۲ مسیرهای عمومی

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/feed?cursor=&limit=` | فید صفحه‌بندی‌شده (post + محصولات + آمار) |
| GET | `/api/posts/:id` | جزئیات پست + کامنت‌های اول |
| GET | `/api/posts/:id/comments?sort=&cursor=` | کامنت‌ها |
| POST | `/api/posts/:id/comments` | ثبت کامنت/پرسش |
| POST | `/api/comments/:id/like` | لایک/آنلایک (toggle) |
| POST | `/api/comments/:id/report` | گزارش |
| POST | `/api/posts/:id/like` | لایک پست |
| GET | `/api/products/:slug` | محصول کامل |
| GET | `/api/search?q=&filters` | جست‌وجوی ترکیبی |
| GET | `/api/collections/:slug` | کالکشن |
| POST | `/api/cart/items` | افزودن (variantId, qty) |
| PATCH | `/api/cart/items/:id` | تغییر تعداد |
| DELETE | `/api/cart/items/:id` | حذف |
| POST | `/api/cart/coupon` | اعتبارسنجی کوپن |
| POST | `/api/checkout/quote` | محاسبهٔ نهایی (ارسال/تخفیف/مالیات) |
| POST | `/api/checkout/place` | ثبت سفارش + رزرو موجودی |
| POST | `/api/payments/verify` | تأیید پرداخت درگاه (callback) |
| GET | `/api/orders/:code?token=` | وضعیت سفارش |
| POST | `/api/auth/otp/request` · `/api/auth/otp/verify` | ورود |
| GET | `/api/inbox/threads` · `POST /api/inbox/messages` | دایرکت |
| GET | `/api/notifications` | اعلان‌ها |
| GET | `/api/events/stream` | SSE برای کامنت لایو، وضعیت سفارش، شمارندهٔ سبد |
| POST | `/api/webhooks/telegram` | وبهوک ربات (تأیید با secret token) |

### ۳.۳ مسیرهای پنل (`/api/admin/*`)

`GET|POST /products` · `PATCH|DELETE /products/:id` · `POST /products/:id/publish` · `GET /inventory` · `POST /inventory/adjust` · `POST /inventory/count-sessions` · `GET /orders` · `PATCH /orders/:id/status` · `POST /orders/:id/refund` · `GET /customers` · `POST /customers/:id/wallet` · `GET /finance/transactions` · `GET /finance/export` · `POST /coupons` · `GET|POST /campaigns` · `POST /campaigns/:id/send` · `GET|POST /posts` (SocialHub) · `POST /posts/:id/publish` · `GET /comments` · `POST /comments/:id/pin` · `GET /inbox/threads` · `POST /inbox/:id/reply` · `GET|POST /staff` · `POST /roles` · `PATCH /roles/:id/permissions` · `GET /audit` · `GET|PATCH /settings` · `POST /settings/test-telegram` · `POST /settings/test-gateway`.

هر مسیر پنل: `requirePermission(...)` + `audit(...)`.

---

## ۴. رویدادها (Domain Events)

`post.created` · `post.published` · `comment.created` · `comment.flagged` · `comment.pinned` · `product.updated` · `variant.stock_low` · `variant.out_of_stock` · `cart.abandoned` · `order.created` · `order.paid` · `order.status_changed` · `order.refunded` · `user.registered` · `review.created` · `campaign.sent`

مصرف‌کننده‌ها: اعلان درون‌برنامه، پیام تلگرام، Web Push، به‌روزرسانی آمار denormalized، ایندکس جست‌وجو، ثبت آنالیتیکس.

---

## ۵. قواعد داده‌ای حیاتی

1. **موجودی اتمیک:** کاهش موجودی داخل تراکنش با `UPDATE ... SET stock = stock - $qty WHERE id = $id AND stock >= $qty` و بررسی `rowCount`؛ در غیر این‌صورت `OUT_OF_STOCK`.
2. **رزرو ۱۰ دقیقه‌ای** در صفحهٔ پرداخت؛ job آزادسازی خودکار.
3. **کد سفارش:** `KIA-` + ۶ رقم تصادفی یکتا (retry روی collision).
4. **Snapshot قیمت** در `CartItem` و `OrderItem` تا تغییر قیمت آینده سفارش قبلی را تغییر ندهد.
5. **Denormalized counters** با `+1/-1` در تراکنش یا با job اصلاح دوره‌ای (شبانه).
6. **کامنت:** نرخ ۵ در دقیقه/کاربر، حداکثر طول ۱۵۰۰ کاراکتر، تعداد لینک حداکثر ۱ (ضد اسپم).
7. **حذف کاربر:** ناشناس‌سازی سفارش‌ها (`userId=null`, `phone` هش‌شده) نه حذف فیزیکی (الزام نگه‌داری مالی).
8. **بکاپ:** روزانه full + WAL؛ تست بازیابی ماهانه.

---

## ۶. ایندکس و کارایی (چک‌لیست)

- `Post(status, publishedAt)` برای فید، `Comment(postId, status, createdAt)` برای لیست کامنت.
- `Order(phone)` و `Order(status, createdAt)`.
- جست‌وجوی فارسی: `pg_trgm` روی `Product.name` + یا Meilisearch با synonym فارسی و نرمال‌سازی «ي/ی»، «ك/ک»، اعراب.
- تصاویر روی CDN (Cloudflare R2/UploadThing) با تبدیل خودکار AVIF/WebP و ۴ اندازه.

---

## ۷. مهاجرت از «کیا شاپ» فعلی

| مرحله | کار |
|---|---|
| ۱ | استخراج دادهٔ فعلی: محصولات، تنوع، سفارش‌ها، مشتریان، کامنت‌ها |
| ۲ | نگاشت: `product.price`, `variants[].stock`, `orders[]`, `customers[]` → اسکیمای جدید |
| ۳ | **مهاجرت قیمت به Decimal** و یکسان‌سازی ارقام فارسی/لاتین در داده |
| ۴ | ساخت `sku` و `slug` یکتا برای رکوردهای بدون آن |
| ۵ | مهاجرت تصاویر به storage جدید + ساخت blurhash |
| ۶ | اسکریپت dry-run با گزارش مغایرت؛ سپس اجرای واقعی در تراکنش |
| ۷ | بازبینی: تعداد رکوردها، مجموع مبالغ، نمونه‌گیری ۲۰ سفارش |
| ۸ | نگه‌داشتن سیستم قدیمی به‌صورت read-only برای ۲ هفته |
