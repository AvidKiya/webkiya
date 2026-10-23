import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import type {
  Product,
  Post,
  Comment,
  Story,
  RetailCartItem,
  WholesaleCartItem,
  PartnerStatus,
  SalesMode,
  PartnerApplication,
  Order,
  OrderStatus,
  DirectThread,
  MagIssue,
  WalletEntry,
  AdminRoleKey,
  StockLedgerEntry,
  AuditLogEntry,
  ActivityEvent,
  QuickReaction,
  StoreRoute,
} from "../types";
import { initialProducts } from "../data/products";
import {
  initialPosts,
  initialComments,
  initialStories,
  initialActivities,
  initialMagIssues,
  initialDirectThreads,
} from "../data/posts";
import {
  ROLE_DEFINITIONS,
  initialOrders,
  initialPartnerApplications,
  initialStockLedger,
  initialWalletEntries,
  initialAuditLogs,
} from "../data/admin";

interface CustomerSession {
  id: string;
  name: string;
  phone: string;
  isVerifiedOtp: boolean;
  partnerStatus: PartnerStatus;
  businessName?: string;
}

interface ToastState {
  message: string;
  type: "success" | "error" | "info" | "warning";
}

interface StoreContextValue {
  // Navigation & Theme
  viewMode: "storefront" | "admin";
  setViewMode: (v: "storefront" | "admin") => void;
  route: StoreRoute;
  setRoute: (r: StoreRoute) => void;
  selectedPostId: string | null;
  setSelectedPostId: (id: string | null) => void;
  activeStoryId: string | null;
  setActiveStoryId: (id: string | null) => void;
  cartSheetOpen: boolean;
  setCartSheetOpen: (open: boolean) => void;
  checkoutOpen: boolean;
  setCheckoutOpen: (open: boolean) => void;
  announcementBanner: string;
  setAnnouncementBanner: (txt: string) => void;
  ordersPaused: boolean;
  setOrdersPaused: (paused: boolean) => void;

  // Customer & Partner Mode
  customer: CustomerSession;
  switchDemoPersona: (preset: "guest" | "pending" | "approved") => void;
  verifyCustomerOtp: (name: string, phone: string) => void;
  salesMode: SalesMode;
  setSalesMode: (mode: SalesMode) => void;
  isApprovedPartner: boolean;

  // Catalog & Social
  products: Product[];
  posts: Post[];
  comments: Comment[];
  stories: Story[];
  activities: ActivityEvent[];
  magIssues: MagIssue[];
  toggleLikePost: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  markStorySeen: (storyId: string) => void;
  addComment: (postId: string, text: string, replyToCommentId?: string) => void;
  toggleCommentReaction: (commentId: string, reaction: QuickReaction) => void;

  // Separate Retail & Wholesale Carts
  retailCart: RetailCartItem[];
  wholesaleCart: WholesaleCartItem[];
  addToRetailCart: (
    productId: string,
    color: string,
    size: string,
    qty?: number,
  ) => void;
  updateRetailQty: (key: string, qty: number) => void;
  removeFromRetailCart: (key: string) => void;
  addToWholesaleCart: (productId: string, packCount: number) => void;
  updateWholesalePacks: (key: string, packCount: number) => void;
  removeFromWholesaleCart: (key: string) => void;
  retailCount: number;
  retailSubtotal: number;
  wholesalePackTotalCount: number;
  wholesaleSubtotal: number;

  // Orders, Wallet & Partner Applications
  orders: Order[];
  walletEntries: WalletEntry[];
  walletBalance: number;
  walletPromoBalance: number;
  topUpWalletDemo: (amountToman: number) => void;
  grantWheelReward: (title: string, amountToman: number) => void;
  hasSpunWheelToday: boolean;
  placeOrder: (payload: {
    salesMode: SalesMode;
    customerName: string;
    customerPhone: string;
    city: string;
    address: string;
    postalCode: string;
    shippingMethod: string;
    shippingCostToman: number;
    couponCode?: string;
    paymentMethod: "zarinpal" | "wallet" | "card_to_card";
  }) => Order | null;
  partnerApplications: PartnerApplication[];
  submitPartnerApplication: (data: {
    applicantName: string;
    phone: string;
    businessName: string;
    city: string;
    channelOrPage: string;
    note: string;
  }) => void;

  // Direct / Support
  directThreads: DirectThread[];
  sendDirectMessage: (
    threadId: string,
    text: string,
    sender: "customer" | "support" | "bot",
    options?: {
      isInternalNote?: boolean;
      productIdAttachment?: string;
      orderCodeAttachment?: string;
    },
  ) => void;
  triggerBotQuickAction: (action: string) => void;

  // Admin & RBAC
  activeAdminRole: AdminRoleKey;
  setActiveAdminRole: (role: AdminRoleKey) => void;
  hasPermission: (perm: string) => boolean;
  stockLedger: StockLedgerEntry[];
  auditLogs: AuditLogEntry[];
  adjustStock: (productId: string, delta: number, reason: string) => boolean;
  reviewPartnerApp: (
    appId: string,
    nextStatus: PartnerStatus,
    reason: string,
  ) => boolean;
  updateOrderStatus: (orderId: string, status: OrderStatus) => boolean;
  saveProductChanges: (updated: Product) => boolean;
  createSocialPostFromProduct: (
    productId: string,
    caption: string,
    badge?: string,
  ) => boolean;

  // Toast
  toast: ToastState | null;
  showToast: (message: string, type?: ToastState["type"]) => void;
  hideToast: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const ACTOR_NAMES: Record<AdminRoleKey, string> = {
  OWNER: "آوید کیا (مالک)",
  ADMIN: "نیما فرهادی (مدیر)",
  WAREHOUSE: "مهدی عباسی (انباردار)",
  SUPPORT: "سارا رضوی (پشتیبان)",
  CONTENT: "الهام کاظمی (محتوا)",
  FINANCE: "فرهاد نوری (مالی)",
  AUDITOR: "کیوان صادقی (بازرس)",
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<"storefront" | "admin">(
    "storefront",
  );
  const routes: StoreRoute[] = [
    "feed",
    "explore",
    "wholesale",
    "profile",
    "inbox",
    "mag",
    "account",
  ];
  const readRoute = () => {
    const hash = window.location.hash.slice(1) as StoreRoute;
    return routes.includes(hash) ? hash : "feed";
  };
  const [route, setRouteState] = useState<StoreRoute>(readRoute);
  const setRoute = useCallback((next: StoreRoute) => {
    window.location.hash = next;
    setRouteState(next);
  }, []);
  useEffect(() => {
    const change = () => setRouteState(readRoute());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [announcementBanner, setAnnouncementBanner] = useState(
    "هر روز جدید، بدون واسطه · ارسال رایگان سفارش‌های تکی بالای ۲ میلیون تومان · خرید عمده همکاران از ۱ جین",
  );
  const [ordersPaused, setOrdersPaused] = useState(false);

  const [customer, setCustomer] = useState<CustomerSession>({
    id: "cust-guest",
    name: "بازدیدکنندهٔ آزمایشی",
    phone: "",
    isVerifiedOtp: false,
    partnerStatus: "NONE",
  });
  const [salesMode, setSalesModeRaw] = useState<SalesMode>("RETAIL");

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [activities] = useState<ActivityEvent[]>(initialActivities);
  const [magIssues] = useState<MagIssue[]>(initialMagIssues);

  const [retailCart, setRetailCart] = useState<RetailCartItem[]>(() => {
    try {
      const saved = localStorage.getItem("kiya-rebuild-retail-cart-v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wholesaleCart, setWholesaleCart] = useState<WholesaleCartItem[]>(
    () => {
      try {
        const saved = localStorage.getItem("kiya-rebuild-wholesale-cart-v1");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    },
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        "kiya-rebuild-retail-cart-v1",
        JSON.stringify(retailCart),
      );
    } catch {}
  }, [retailCart]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "kiya-rebuild-wholesale-cart-v1",
        JSON.stringify(wholesaleCart),
      );
    } catch {}
  }, [wholesaleCart]);

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [walletEntries, setWalletEntries] =
    useState<WalletEntry[]>(initialWalletEntries);
  const [hasSpunWheelToday, setHasSpunWheelToday] = useState(false);
  const [partnerApplications, setPartnerApplications] = useState<
    PartnerApplication[]
  >(initialPartnerApplications);
  const [directThreads, setDirectThreads] =
    useState<DirectThread[]>(initialDirectThreads);

  const [activeAdminRole, setActiveAdminRole] = useState<AdminRoleKey>("OWNER");
  const [stockLedger, setStockLedger] =
    useState<StockLedgerEntry[]>(initialStockLedger);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialAuditLogs);

  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback(
    (message: string, type: ToastState["type"] = "success") => {
      setToast({ message, type });
    },
    [],
  );
  const hideToast = useCallback(() => setToast(null), []);

  const isApprovedPartner = customer.partnerStatus === "APPROVED";

  // Enforce strict guard: non-approved users cannot stay in WHOLESALE salesMode
  useEffect(() => {
    if (!isApprovedPartner && salesMode === "WHOLESALE") {
      setSalesModeRaw("RETAIL");
    }
  }, [isApprovedPartner, salesMode]);

  const setSalesMode = useCallback(
    (mode: SalesMode) => {
      if (mode === "WHOLESALE" && !isApprovedPartner) {
        showToast(
          "نمایش قیمت و خرید عمده جینی فقط برای حساب همکار تأییدشده فعال است.",
          "warning",
        );
        setRoute("wholesale");
        return;
      }
      setSalesModeRaw(mode);
    },
    [isApprovedPartner, showToast],
  );

  const switchDemoPersona = useCallback(
    (preset: "guest" | "pending" | "approved") => {
      if (preset === "guest") {
        setCustomer({
          id: "cust-guest",
          name: "مهسا رادمنش",
          phone: "09121112233",
          isVerifiedOtp: true,
          partnerStatus: "NONE",
        });
        setSalesModeRaw("RETAIL");
        showToast(
          "نمای مشتری عادی (تک‌فروشی) فعال شد؛ قیمت‌های عمده مخفی هستند.",
          "info",
        );
      } else if (preset === "pending") {
        setCustomer({
          id: "cust-pending-1",
          name: "بهرام رستمی",
          phone: "09134445566",
          isVerifiedOtp: true,
          partnerStatus: "PENDING",
          businessName: "بوتیک اکسسوری آفتاب",
        });
        setSalesModeRaw("RETAIL");
        showToast(
          "نمای متقاضی همکاری (در انتظار تأیید پشتیبانی) فعال شد.",
          "info",
        );
      } else {
        setCustomer({
          id: "cust-approved-1",
          name: "حمیدرضا کریمی",
          phone: "09173334455",
          isVerifiedOtp: true,
          partnerStatus: "APPROVED",
          businessName: "گالری چرم پارسیان",
        });
        setSalesModeRaw("WHOLESALE");
        showToast(
          "حساب همکار تأییدشده فعال شد! قیمت عمده و خرید جینی باز است.",
          "success",
        );
      }
    },
    [showToast],
  );

  const verifyCustomerOtp = useCallback((name: string, phone: string) => {
    setCustomer((prev) => ({
      ...prev,
      name: name.trim() || prev.name,
      phone: phone.trim() || prev.phone,
      isVerifiedOtp: true,
    }));
  }, []);

  const hasPermission = useCallback(
    (perm: string) => {
      const roleDef = ROLE_DEFINITIONS.find((r) => r.key === activeAdminRole);
      return roleDef ? roleDef.permissions.includes(perm) : false;
    },
    [activeAdminRole],
  );

  const appendAudit = useCallback(
    (
      action: string,
      target: string,
      detail: string,
      severity: AuditLogEntry["severity"] = "info",
    ) => {
      const entry: AuditLogEntry = {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorName: ACTOR_NAMES[activeAdminRole],
        actorRole: activeAdminRole,
        action,
        target,
        detail,
        createdAt: new Date().toISOString(),
        severity,
      };
      setAuditLogs((prev) => [entry, ...prev]);
    },
    [activeAdminRole],
  );

  // Social interactions
  const toggleLikePost = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !p.isLiked,
              likes: p.isLiked ? p.likes - 1 : p.likes + 1,
            }
          : p,
      ),
    );
  }, []);

  const toggleSavePost = useCallback(
    (postId: string) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const nextSaved = !p.isSaved;
          showToast(
            nextSaved
              ? "پست در لیست علاقه‌مندی‌ها ذخیره شد"
              : "از ذخیره‌شده‌ها برداشته شد",
            "info",
          );
          return { ...p, isSaved: nextSaved };
        }),
      );
    },
    [showToast],
  );

  const markStorySeen = useCallback((storyId: string) => {
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, seen: true } : s)),
    );
  }, []);

  const addComment = useCallback(
    (postId: string, text: string, replyToCommentId?: string) => {
      const clean = text.trim();
      if (!clean) return;
      if (replyToCommentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyToCommentId
              ? {
                  ...c,
                  replies: [
                    ...c.replies,
                    {
                      id: `rep-${Date.now()}`,
                      authorName: customer.name,
                      authorAvatar:
                        "https://images.pexels.com/photos/35367077/pexels-photo-35367077.jpeg?auto=compress&cs=tinysrgb&dpr=1&h=100&w=100",
                      text: clean,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : c,
          ),
        );
      } else {
        const hasDeliveredOrder = orders.some(
          (o) =>
            o.status === "delivered" &&
            o.customerPhone === customer.phone &&
            o.lines.some((l) => {
              const post = posts.find((p) => p.id === postId);
              return post && l.productId === post.productId;
            }),
        );
        const newComment: Comment = {
          id: `cm-${Date.now()}`,
          postId,
          author: {
            name: customer.name,
            username: "kiya_user",
            avatar:
              "https://images.pexels.com/photos/35367077/pexels-photo-35367077.jpeg?auto=compress&cs=tinysrgb&dpr=1&h=100&w=100",
            isVerifiedBuyer: hasDeliveredOrder || customer.id === "cust-guest",
          },
          text: clean,
          likes: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
          replies: [],
        };
        setComments((prev) => [newComment, ...prev]);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p,
          ),
        );
      }
      showToast("دیدگاه شما ثبت شد", "success");
    },
    [customer, orders, posts, showToast],
  );

  const toggleCommentReaction = useCallback(
    (commentId: string, reaction: QuickReaction) => {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          const clearing = c.activeReaction === reaction;
          return {
            ...c,
            activeReaction: clearing ? undefined : reaction,
            likes: clearing
              ? Math.max(0, c.likes - 1)
              : c.activeReaction
                ? c.likes
                : c.likes + 1,
            isLiked: !clearing && reaction === "♥",
          };
        }),
      );
    },
    [],
  );

  // Retail Cart
  const addToRetailCart = useCallback(
    (productId: string, color: string, size: string, qty = 1) => {
      if (ordersPaused) {
        showToast("ثبت سفارش موقتاً توسط مدیریت متوقف شده است.", "warning");
        return;
      }
      const product = products.find((p) => p.id === productId);
      if (!product || product.stock < qty) {
        showToast("موجودی این کالا کافی نیست.", "error");
        return;
      }
      const key = `${productId}__${color}__${size}`;
      setRetailCart((prev) => {
        const existing = prev.find((i) => i.key === key);
        const currentQty = existing ? existing.quantity : 0;
        if (currentQty + qty > product.stock) {
          showToast(
            `حداکثر موجودی قابل خرید ${product.stock} عدد است.`,
            "warning",
          );
          return prev;
        }
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + qty } : i,
          );
        }
        return [...prev, { key, productId, color, size, quantity: qty }];
      });
      showToast(`«${product.name}» به سبد خرید تکی اضافه شد`, "success");
    },
    [ordersPaused, products, showToast],
  );

  const updateRetailQty = useCallback(
    (key: string, qty: number) => {
      if (qty <= 0) {
        setRetailCart((prev) => prev.filter((i) => i.key !== key));
        return;
      }
      setRetailCart((prev) =>
        prev.map((item) => {
          if (item.key !== key) return item;
          const prod = products.find((p) => p.id === item.productId);
          const capped = prod ? Math.min(prod.stock, qty) : qty;
          return { ...item, quantity: capped };
        }),
      );
    },
    [products],
  );

  const removeFromRetailCart = useCallback((key: string) => {
    setRetailCart((prev) => prev.filter((i) => i.key !== key));
  }, []);

  // Wholesale Cart (Strict WH01..WH11 rules: approved partner only, integer packs >= 1, shared SKU stock)
  const addToWholesaleCart = useCallback(
    (productId: string, packCount: number) => {
      if (!isApprovedPartner) {
        showToast(
          "خطای دسترسی (PARTNER_NOT_APPROVED): خرید عمده فقط برای همکاران تأییدشده مجاز است.",
          "error",
        );
        return;
      }
      if (!Number.isInteger(packCount) || packCount < 1) {
        showToast(
          "حداقل خرید عمده ۱ جین کامل با گام عدد صحیح است (کسری جین مجاز نیست).",
          "error",
        );
        return;
      }
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      if (
        product.packDefinition.priceMode === "INQUIRY" ||
        product.packDefinition.wholesaleUnitPriceToman <= 0
      ) {
        showToast(
          "این کالا استعلامی است؛ لطفاً از طریق دایرکت واحد همکاران استعلام بگیرید.",
          "info",
        );
        setRoute("inbox");
        return;
      }
      const maxAvailablePacks = Math.floor(
        product.stock / product.packDefinition.unitsPerPack,
      );
      if (maxAvailablePacks < 1) {
        showToast("موجودی انبار برای تشکیل ۱ جین کامل کافی نیست.", "warning");
        return;
      }
      const key = `${productId}__${product.packDefinition.id}`;
      setWholesaleCart((prev) => {
        const existing = prev.find((i) => i.key === key);
        const nextPacks = (existing ? existing.packCount : 0) + packCount;
        if (nextPacks > maxAvailablePacks) {
          showToast(
            `حداکثر ${maxAvailablePacks} جین از این کالا قابل تأمین است.`,
            "warning",
          );
          return prev;
        }
        if (existing) {
          return prev.map((i) =>
            i.key === key ? { ...i, packCount: nextPacks } : i,
          );
        }
        return [
          ...prev,
          { key, productId, packId: product.packDefinition.id, packCount },
        ];
      });
      showToast(
        `${packCount} جین از «${product.name}» به سبد عمده همکاران اضافه شد`,
        "success",
      );
    },
    [isApprovedPartner, products, showToast],
  );

  const updateWholesalePacks = useCallback(
    (key: string, packCount: number) => {
      if (!Number.isInteger(packCount)) return;
      if (packCount <= 0) {
        setWholesaleCart((prev) => prev.filter((i) => i.key !== key));
        return;
      }
      setWholesaleCart((prev) =>
        prev.map((item) => {
          if (item.key !== key) return item;
          const prod = products.find((p) => p.id === item.productId);
          if (!prod) return item;
          const maxPacks = Math.max(
            1,
            Math.floor(prod.stock / prod.packDefinition.unitsPerPack),
          );
          return { ...item, packCount: Math.min(maxPacks, packCount) };
        }),
      );
    },
    [products],
  );

  const removeFromWholesaleCart = useCallback((key: string) => {
    setWholesaleCart((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const retailCount = useMemo(
    () => retailCart.reduce((sum, item) => sum + item.quantity, 0),
    [retailCart],
  );

  const retailSubtotal = useMemo(
    () =>
      retailCart.reduce((sum, item) => {
        const p = products.find((pr) => pr.id === item.productId);
        return sum + (p ? p.price * item.quantity : 0);
      }, 0),
    [retailCart, products],
  );

  const wholesalePackTotalCount = useMemo(
    () => wholesaleCart.reduce((sum, item) => sum + item.packCount, 0),
    [wholesaleCart],
  );

  const wholesaleSubtotal = useMemo(
    () =>
      wholesaleCart.reduce((sum, item) => {
        const p = products.find((pr) => pr.id === item.productId);
        if (!p || p.packDefinition.priceMode !== "FIXED") return sum;
        const packPrice =
          p.packDefinition.wholesaleUnitPriceToman *
          p.packDefinition.unitsPerPack;
        return sum + packPrice * item.packCount;
      }, 0),
    [wholesaleCart, products],
  );

  // Wallet balances
  const walletBalance = useMemo(
    () => walletEntries.reduce((sum, e) => sum + e.amountToman, 0),
    [walletEntries],
  );
  const walletPromoBalance = useMemo(
    () =>
      walletEntries
        .filter((e) => e.isPromoCredit)
        .reduce((sum, e) => sum + e.amountToman, 0),
    [walletEntries],
  );

  const topUpWalletDemo = useCallback(
    (amountToman: number) => {
      if (amountToman <= 0) return;
      setWalletEntries((prev) => [
        {
          id: `wl-${Date.now()}`,
          type: "TOPUP",
          title: "شارژ کیف پول (تأیید شبیه‌ساز درگاه آزمایشی)",
          amountToman,
          isPromoCredit: false,
          refCode: `DEMO-${Math.floor(100000 + Math.random() * 900000)}`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      showToast("شارژ کیف پول در دفتر کل ثبت شد", "success");
    },
    [showToast],
  );

  const grantWheelReward = useCallback(
    (title: string, amountToman: number) => {
      if (hasSpunWheelToday) return;
      setHasSpunWheelToday(true);
      if (amountToman > 0) {
        setWalletEntries((prev) => [
          {
            id: `wl-wheel-${Date.now()}`,
            type: "PROMO_CREDIT",
            title: `${title} (اعتبار تبلیغاتی غیرقابل برداشت نقدی)`,
            amountToman,
            isPromoCredit: true,
            refCode: `WHL-${Date.now().toString().slice(-5)}`,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      showToast(`نتیجه گردونه: ${title}`, "success");
    },
    [hasSpunWheelToday, showToast],
  );

  // Until reviewed server checkout is wired, never create paid orders in the browser.
  const placeOrder = useCallback(
    (
      _payload: Parameters<StoreContextValue["placeOrder"]>[0],
    ): Order | null => {
      showToast(
        "پرداخت و ثبت نهایی هنوز متصل نیست؛ هیچ وجه یا سفارش واقعی ثبت نشد.",
        "warning",
      );
      return null;
    },
    [showToast],
  );

  const submitPartnerApplication = useCallback(
    (data: {
      applicantName: string;
      phone: string;
      businessName: string;
      city: string;
      channelOrPage: string;
      note: string;
    }) => {
      const appId = `pa-${Date.now().toString().slice(-4)}`;
      const newApp: PartnerApplication = {
        id: appId,
        customerId: customer.id,
        applicantName: data.applicantName,
        phone: data.phone,
        businessName: data.businessName,
        city: data.city,
        channelOrPage: data.channelOrPage,
        note: data.note,
        status: "PENDING",
        submittedAt: new Date().toISOString(),
        policyVersion: 1,
      };
      setPartnerApplications((prev) => [newApp, ...prev]);
      setCustomer((prev) => ({
        ...prev,
        name: data.applicantName,
        phone: data.phone,
        businessName: data.businessName,
        partnerStatus: "PENDING",
      }));
      showToast(
        "درخواست همکاری عمده ثبت شد و در صف بررسی پشتیبانی قرار گرفت.",
        "success",
      );
    },
    [customer.id, showToast],
  );

  // Direct Inbox & Bot
  const sendDirectMessage = useCallback(
    (
      threadId: string,
      text: string,
      sender: "customer" | "support" | "bot",
      options?: {
        isInternalNote?: boolean;
        productIdAttachment?: string;
        orderCodeAttachment?: string;
      },
    ) => {
      const clean = text.trim();
      if (!clean) return;
      setDirectThreads((prev) =>
        prev.map((th) => {
          if (th.id !== threadId) return th;
          return {
            ...th,
            updatedAt: new Date().toISOString(),
            unreadCount: sender === "customer" ? 0 : th.unreadCount,
            messages: [
              ...th.messages,
              {
                id: `msg-${Date.now()}`,
                sender,
                senderName:
                  sender === "customer"
                    ? customer.name
                    : options?.isInternalNote
                      ? `یادداشت محرمانه (${ACTOR_NAMES[activeAdminRole]})`
                      : `${ACTOR_NAMES[activeAdminRole]} · پشتیبانی کیا`,
                text: clean,
                createdAt: new Date().toISOString(),
                isInternalNote: options?.isInternalNote,
                productIdAttachment: options?.productIdAttachment,
                orderCodeAttachment: options?.orderCodeAttachment,
              },
            ],
          };
        }),
      );
      if (options?.isInternalNote) {
        appendAudit(
          "support:internal_note",
          threadId,
          "ثبت یادداشت داخلی محرمانه روی پرونده پشتیبانی",
        );
      }
    },
    [customer.name, activeAdminRole, appendAudit],
  );

  const triggerBotQuickAction = useCallback(
    (action: string) => {
      let replyText = "";
      let attachedOrder: string | undefined;
      if (action === "TRACK_LAST") {
        const latest = orders[0];
        if (latest) {
          replyText = `آخرین سفارش ثبت‌شده در سامانه: کد ${latest.code} به نام «${latest.customerName}» — روش ارسال: ${latest.shippingMethod}. برای مشاهده تایم‌لاین کامل روی کارت زیر بزنید.`;
          attachedOrder = latest.code;
        } else {
          replyText = "هنوز سفارشی ثبت نشده است.";
        }
      } else if (action === "WHOLESALE_INFO") {
        replyText =
          "شرایط قطعی عمده‌فروشی کیا: ۱) ثبت و تأیید حساب همکاری در بخش «عمده و همکاری» · ۲) حداقل سفارش فقط ۱ جین کامل با گام ۱ جین (بدون حداقل مبلغ اضافی!) · ۳) نمایش هر سه قیمت واحد عمده، جین و تک‌فروشی پس از تأیید.";
      } else if (action === "SHIPPING_INFO") {
        replyText =
          "ارسال سفارش‌های تهران با پیک اختصاصی (امکان انتخاب بازه زمانی) و شهرستان با پست پیشتاز ۲ تا ۴ روز کاری انجام می‌شود. سفارش‌های تکی بالای ۲ میلیون تومان ارسال رایگان دارند.";
      } else {
        replyText =
          "درخواست شما به صف کارشناسان پشتیبانی کیا ارجاع شد. میانگین زمان پاسخ‌گویی در ساعات کاری کمتر از ۱۰ دقیقه است.";
      }

      setDirectThreads((prev) =>
        prev.map((th) =>
          th.id === "th-bot"
            ? {
                ...th,
                updatedAt: new Date().toISOString(),
                messages: [
                  ...th.messages,
                  {
                    id: `msg-bot-${Date.now()}`,
                    sender: "bot",
                    senderName: "ربات کیا (@kiyaco24bot)",
                    text: replyText,
                    orderCodeAttachment: attachedOrder,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : th,
        ),
      );
    },
    [orders],
  );

  // Admin Mutations with RBAC + Audit
  const adjustStock = useCallback(
    (productId: string, delta: number, reason: string): boolean => {
      if (!hasPermission("inventory:write")) {
        showToast(
          "نقش فعلی شما مجوز «inventory:write» برای تغییر موجودی انبار را ندارد.",
          "error",
        );
        return false;
      }
      const target = products.find((p) => p.id === productId);
      if (!target) return false;
      const nextStock = Math.max(0, target.stock + delta);
      const actualDelta = nextStock - target.stock;
      if (actualDelta === 0) return false;

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: nextStock } : p)),
      );
      setStockLedger((prev) => [
        {
          id: `sl-${Date.now()}`,
          productId,
          productName: target.name,
          sku: target.sku,
          delta: actualDelta,
          balanceAfter: nextStock,
          reason,
          actor: ACTOR_NAMES[activeAdminRole],
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      appendAudit(
        "inventory:adjust",
        target.sku,
        `تغییر موجودی (${actualDelta > 0 ? `+${actualDelta}` : actualDelta}) — موجودی جدید: ${nextStock} — علت: ${reason}`,
      );
      showToast(
        `موجودی «${target.sku}» به ${nextStock} عدد بروزرسانی شد`,
        "success",
      );
      return true;
    },
    [hasPermission, products, activeAdminRole, appendAudit, showToast],
  );

  const reviewPartnerApp = useCallback(
    (appId: string, nextStatus: PartnerStatus, reason: string): boolean => {
      const requiredPerm =
        nextStatus === "APPROVED"
          ? "partner:approve"
          : nextStatus === "SUSPENDED"
            ? "partner:suspend"
            : "partner:review";
      if (!hasPermission(requiredPerm)) {
        showToast(`نقش فعلی شما مجوز «${requiredPerm}» را ندارد.`, "error");
        return false;
      }
      const app = partnerApplications.find((a) => a.id === appId);
      if (!app) return false;

      // WH02: Prevent self-approval by staff! Only OWNER can override/review staff-owned customer account
      if (
        app.customerId === "staff-support-self" &&
        activeAdminRole !== "OWNER"
      ) {
        showToast(
          "نگهبان امنیتی WH02: هیچ کارمندی مجاز به تأیید پرونده همکاری متعلق به حساب شخصی خودش نیست! نیازمند بررسی مالک (OWNER).",
          "error",
        );
        appendAudit(
          "security:self_approval_blocked",
          app.id,
          "تلاش برای تأیید پرونده همکاری متعلق به خود کارمند مسدود شد.",
          "critical",
        );
        return false;
      }

      setPartnerApplications((prev) =>
        prev.map((a) =>
          a.id === appId
            ? {
                ...a,
                status: nextStatus,
                reviewedBy: ACTOR_NAMES[activeAdminRole],
                reviewReason: reason || "بررسی توسط واحد همکاران",
              }
            : a,
        ),
      );

      // Sync storefront session if matching customer
      if (app.customerId === customer.id || app.phone === customer.phone) {
        setCustomer((prev) => ({
          ...prev,
          partnerStatus: nextStatus,
          businessName: app.businessName,
        }));
      }

      appendAudit(
        `partner:${nextStatus.toLowerCase()}`,
        `${app.businessName} (${app.id})`,
        `تغییر وضعیت همکاری به ${nextStatus} — توضیح: ${reason || "ثبت در صف همکاری"}`,
        nextStatus === "SUSPENDED" ? "critical" : "warning",
      );
      showToast(
        `وضعیت پرونده «${app.businessName}» به ${nextStatus} تغییر یافت`,
        "success",
      );
      return true;
    },
    [
      hasPermission,
      partnerApplications,
      activeAdminRole,
      customer.id,
      customer.phone,
      appendAudit,
      showToast,
    ],
  );

  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderStatus): boolean => {
      if (!hasPermission("order:status:update")) {
        showToast("نقش فعلی شما مجوز «order:status:update» را ندارد.", "error");
        return false;
      }
      const ord = orders.find((o) => o.id === orderId);
      if (!ord) return false;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
      appendAudit(
        "order:status:update",
        ord.code,
        `تغییر وضعیت سفارش به ${status}`,
      );
      showToast(`وضعیت سفارش ${ord.code} بروزرسانی شد`, "success");
      return true;
    },
    [hasPermission, orders, appendAudit, showToast],
  );

  const saveProductChanges = useCallback(
    (updated: Product): boolean => {
      if (!hasPermission("product:write")) {
        showToast(
          "نقش فعلی شما مجوز ویرایش محصول («product:write») را ندارد.",
          "error",
        );
        return false;
      }
      const existing = products.find((p) => p.id === updated.id);
      if (existing) {
        const priceDiffRatio =
          Math.abs(updated.price - existing.price) / existing.price;
        if (priceDiffRatio > 0.15 && !hasPermission("product:price:approve")) {
          showToast(
            "تغییر قیمت بیش از ۱۵٪ نیازمند تأیید دو مرحله‌ای مالک فروشگاه («product:price:approve») است.",
            "warning",
          );
          appendAudit(
            "product:price_guard_triggered",
            updated.sku,
            "درخواست تغییر قیمت بیش از ۱۵٪ متوقف و نیازمند تأیید مالک شد.",
            "warning",
          );
          return false;
        }
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        appendAudit(
          "product:update",
          updated.sku,
          `بروزرسانی محصول و جین (${updated.packDefinition.unitsPerPack} واحدی)`,
        );
      } else {
        setProducts((prev) => [updated, ...prev]);
        appendAudit(
          "product:create",
          updated.sku,
          `ایجاد کالای جدید «${updated.name}»`,
        );
      }
      showToast("اطلاعات محصول و تعریف جین ذخیره شد", "success");
      return true;
    },
    [hasPermission, products, appendAudit, showToast],
  );

  const createSocialPostFromProduct = useCallback(
    (productId: string, caption: string, badge?: string): boolean => {
      if (!hasPermission("social:publish")) {
        showToast(
          "نقش فعلی شما مجوز انتشار محتوا («social:publish») را ندارد.",
          "error",
        );
        return false;
      }
      const prod = products.find((p) => p.id === productId);
      if (!prod) return false;
      const newPost: Post = {
        id: `post-${Date.now()}`,
        productId,
        caption,
        likes: 1,
        commentsCount: 0,
        isLiked: false,
        isSaved: false,
        badge: badge || "انتشار جدید",
        createdAt: new Date().toISOString(),
      };
      setPosts((prev) => [newPost, ...prev]);
      appendAudit(
        "social:publish_feed",
        prod.sku,
        "انتشار پست جدید در فید فروشگاه از SocialHub (بدون قیمت عمده)",
      );
      showToast("پست جدید در فید فروشگاه منتشر شد!", "success");
      return true;
    },
    [hasPermission, products, appendAudit, showToast],
  );

  const value: StoreContextValue = {
    viewMode,
    setViewMode,
    route,
    setRoute,
    selectedPostId,
    setSelectedPostId,
    activeStoryId,
    setActiveStoryId,
    cartSheetOpen,
    setCartSheetOpen,
    checkoutOpen,
    setCheckoutOpen,
    announcementBanner,
    setAnnouncementBanner,
    ordersPaused,
    setOrdersPaused,
    customer,
    switchDemoPersona,
    verifyCustomerOtp,
    salesMode,
    setSalesMode,
    isApprovedPartner,
    products,
    posts,
    comments,
    stories,
    activities,
    magIssues,
    toggleLikePost,
    toggleSavePost,
    markStorySeen,
    addComment,
    toggleCommentReaction,
    retailCart,
    wholesaleCart,
    addToRetailCart,
    updateRetailQty,
    removeFromRetailCart,
    addToWholesaleCart,
    updateWholesalePacks,
    removeFromWholesaleCart,
    retailCount,
    retailSubtotal,
    wholesalePackTotalCount,
    wholesaleSubtotal,
    orders,
    walletEntries,
    walletBalance,
    walletPromoBalance,
    topUpWalletDemo,
    grantWheelReward,
    hasSpunWheelToday,
    placeOrder,
    partnerApplications,
    submitPartnerApplication,
    directThreads,
    sendDirectMessage,
    triggerBotQuickAction,
    activeAdminRole,
    setActiveAdminRole,
    hasPermission,
    stockLedger,
    auditLogs,
    adjustStock,
    reviewPartnerApp,
    updateOrderStatus,
    saveProductChanges,
    createSocialPostFromProduct,
    toast,
    showToast,
    hideToast,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
