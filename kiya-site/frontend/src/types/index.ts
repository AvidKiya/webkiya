export type CategorySlug =
  | "other"
  | "bags"
  | "shoes"
  | "belts"
  | "personal-accessories"
  | "mobile-accessories"
  | "small-decor-gifts"
  | "underwear";

export type AudienceType = "زنانه" | "مردانه" | "یونیسکس";

export type PartnerStatus =
  "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "EXPIRED";

export type SalesMode = "RETAIL" | "WHOLESALE";

export interface PackComponent {
  variantLabel: string;
  units: number;
}

export interface PackDefinition {
  id: string;
  label: string;
  type: "FIXED_ASSORTMENT" | "HOMOGENEOUS";
  unitsPerPack: number;
  version: number;
  components: PackComponent[];
  wholesaleUnitPriceToman: number;
  priceMode: "FIXED" | "INQUIRY";
}

export interface ProductSpecItem {
  label: string;
  value: string;
}

export interface Product {
  variantRefs?: { id: string; name: string }[];
  serverManaged?: boolean;
  isDemo?: boolean;
  id: string;
  slug: string;
  sku: string;
  name: string;
  shortDescription: string;
  description: string;
  categorySlug: CategorySlug;
  categoryName: string;
  audience: AudienceType;
  price: number;
  comparePrice?: number;
  costToman?: number;
  images: string[];
  colors: string[];
  sizes: string[];
  sizeLabel?: string; // e.g., 'سایز', 'مدل گوشی', 'طول کمربند'
  stock: number;
  lowStockThreshold: number;
  soldCount: number;
  rating: number;
  reviewCount: number;
  isNew?: boolean;
  isFeatured?: boolean;
  hygieneReturnNote?: string;
  sizeGuideNote: string;
  specs: ProductSpecItem[];
  faqs: { q: string; a: string }[];
  tags: string[];
  packDefinition: PackDefinition;
  createdAt: string;
}

export type QuickReaction = "♥" | "👍" | "🔥" | "❓";

export interface CommentReply {
  id: string;
  authorName: string;
  authorAvatar: string;
  isSeller?: boolean;
  text: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  author: {
    name: string;
    username: string;
    avatar: string;
    isVerifiedBuyer: boolean;
    isSeller?: boolean;
  };
  text: string;
  likes: number;
  isLiked?: boolean;
  activeReaction?: QuickReaction;
  createdAt: string;
  replies: CommentReply[];
}

export interface Post {
  id: string;
  productId: string;
  caption: string;
  likes: number;
  commentsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: string;
  badge?: string;
}

export interface StoryFrame {
  id: string;
  image: string;
  headline: string;
  subtext: string;
  productId: string;
}

export interface Story {
  id: string;
  type: "drop" | "sale" | "collection" | "live";
  title: string;
  subtitle: string;
  coverImage: string;
  seen: boolean;
  frames: StoryFrame[];
}

export interface RetailCartItem {
  key: string;
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

export interface WholesaleCartItem {
  key: string;
  productId: string;
  packId: string;
  packCount: number; // integer >= 1 (تعداد جین)
}

export interface ActivityEvent {
  id: string;
  type: "purchase" | "view" | "low_stock" | "review";
  text: string;
  timeAgo: string;
  productId?: string;
}

export interface PartnerApplication {
  id: string;
  customerId: string;
  applicantName: string;
  phone: string;
  businessName: string;
  city: string;
  channelOrPage: string;
  note: string;
  status: PartnerStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewReason?: string;
  policyVersion: number;
}

export type OrderStatus =
  "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled";

export interface OrderLineSnapshot {
  productId: string;
  productName: string;
  sku: string;
  image: string;
  variantSummary: string;
  quantityUnits: number;
  packCount?: number;
  unitPriceToman: number;
  lineTotalToman: number;
}

export interface Order {
  id: string;
  code: string;
  salesMode: SalesMode;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  city: string;
  address: string;
  postalCode: string;
  shippingMethod: string;
  shippingCostToman: number;
  discountToman: number;
  subtotalToman: number;
  totalToman: number;
  paymentMethod: "zarinpal" | "wallet" | "card_to_card";
  lines: OrderLineSnapshot[];
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  sender: "customer" | "support" | "bot";
  senderName: string;
  text: string;
  createdAt: string;
  orderCodeAttachment?: string;
  productIdAttachment?: string;
  isInternalNote?: boolean;
  quickActions?: { label: string; action: string }[];
}

export interface DirectThread {
  id: string;
  title: string;
  tag: "ربات سفارش" | "پشتیبانی خرید" | "استعلام عمده";
  unreadCount: number;
  customerName: string;
  customerPhone: string;
  assignedTo: string;
  updatedAt: string;
  messages: DirectMessage[];
}

export interface MagIssue {
  id: string;
  slug: string;
  issueNumber: number;
  title: string;
  subtitle: string;
  coverImage: string;
  publishedAt: string;
  readTime: string;
  excerpt: string;
  sections: {
    heading: string;
    body: string;
    featuredProductIds: string[];
  }[];
}

export interface WalletEntry {
  id: string;
  type: "TOPUP" | "ORDER_PAYMENT" | "PROMO_CREDIT" | "REFUND";
  title: string;
  amountToman: number; // positive or negative
  isPromoCredit: boolean;
  refCode: string;
  createdAt: string;
}

export type AdminRoleKey =
  | "OWNER"
  | "ADMIN"
  | "WAREHOUSE"
  | "SUPPORT"
  | "CONTENT"
  | "FINANCE"
  | "AUDITOR";

export interface RoleDefinition {
  key: AdminRoleKey;
  nameFa: string;
  description: string;
  scopeLabel: string;
  permissions: string[];
}

export interface StockLedgerEntry {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  actor: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorRole: AdminRoleKey;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
}

export interface IntegrationRecord {
  id: string;
  title: string;
  publicHandle: string;
  status: "UNCONFIGURED" | "REQUIRES_NEW_SECRET" | "UNVERIFIED" | "MANUAL_PACK";
  envVarName: string;
  note: string;
  lastChecked: string;
}

export type StoreRoute =
  "feed" | "explore" | "wholesale" | "profile" | "inbox" | "mag" | "account";
