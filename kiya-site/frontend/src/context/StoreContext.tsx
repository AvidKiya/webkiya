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
import { fetchCatalog, api } from "../services/catalog";
import {
  initialPartnerApplications,
  initialStockLedger,
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
  catalogState: "loading" | "ready" | "error";
  catalogError: string;
  reloadCatalog: () => void;
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
  openServerCart: (mode: SalesMode) => void;
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
  addComment: (
    postId: string,
    text: string,
    replyToCommentId?: string,
  ) => Promise<boolean>;
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
  const [viewMode, setViewModeState] = useState<"storefront" | "admin">(
    "storefront",
  );
  const setViewMode = useCallback((mode: "storefront" | "admin") => {
    if (mode === "admin") {
      window.location.assign("/admin");
      return;
    }
    setViewModeState(mode);
  }, []);
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
  const checkoutOpen = false;
  const setCheckoutOpen = useCallback((open: boolean) => {
    if (open) setCartSheetOpen(true);
  }, []);
  const [announcementBanner, setAnnouncementBanner] = useState(
    "",
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

  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [activities] = useState<ActivityEvent[]>([]);
  const [magIssues] = useState<MagIssue[]>([]);

  const [catalogState, setCatalogState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [catalogError, setCatalogError] = useState("");
  const [catalogRevision, setCatalogRevision] = useState(0);
  const reloadCatalog = useCallback(() => setCatalogRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogState("loading");
    setCatalogError("");
    fetchCatalog(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setProducts(data.products);
        setPosts(data.posts);
        setComments([]);
        setCatalogState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setProducts([]);
        setPosts([]);
        setComments([]);
        setCatalogError(
          error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد.",
        );
        setCatalogState("error");
      });
    return () => controller.abort();
  }, [catalogRevision]);
  const [retailCart, setRetailCart] = useState<RetailCartItem[]>([]);
  const [wholesaleCart, setWholesaleCart] = useState<WholesaleCartItem[]>([]);

  useEffect(() => {
    setSelectedPostId(null);
    setActiveStoryId(null);
    setCartSheetOpen(false);
  }, [route]);
  useEffect(() => {
    let active = true;
    api<{
      lines: {
        id: string;
        productId: string;
        selection: string;
        quantity: number;
      }[];
    }>("/api/cart?mode=RETAIL")
      .then((data) => {
        if (active)
          setRetailCart(
            data.lines.map((line) => ({
              key: line.id,
              productId: line.productId,
              color: line.selection,
              size: "",
              quantity: line.quantity,
            })),
          );
      })
      .catch(() => {
        if (active) setRetailCart([]);
      });
    return () => {
      active = false;
    };
  }, [cartSheetOpen, route]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [walletEntries, setWalletEntries] = useState<WalletEntry[]>([]);
  const [hasSpunWheelToday, setHasSpunWheelToday] = useState(false);
  const [partnerApplications, setPartnerApplications] = useState<
    PartnerApplication[]
  >(initialPartnerApplications);
  const [directThreads] = useState<DirectThread[]>([]);

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
    if (!isApprovedPartner && salesMode === "WHOLESALE" && !cartSheetOpen) {
      setSalesModeRaw("RETAIL");
    }
  }, [isApprovedPartner, salesMode, cartSheetOpen]);

  // Wholesale rates are read only inside the private catalog, never merged into public products.
  const setSalesMode = useCallback(
    (mode: SalesMode) => {
      setSalesModeRaw("RETAIL");
      if (mode === "WHOLESALE") setRoute("wholesale");
    },
    [setRoute],
  );
  const openServerCart = useCallback((mode: SalesMode) => {
    setSalesModeRaw(mode);
    setCartSheetOpen(true);
  }, []);

  const switchDemoPersona = useCallback(
    (_preset: "guest" | "pending" | "approved") => {
      showToast(
        "وضعیت همکاری فقط با ورود و تأیید پشتیبانی در سرور تغییر می‌کند.",
        "warning",
      );
    },
    [showToast],
  );
  const verifyCustomerOtp = useCallback(
    (_name: string, _phone: string) => {
      showToast(
        "تأیید پیامک هنوز پیکربندی نشده است؛ ورود تأیید نشد.",
        "warning",
      );
    },
    [showToast],
  );
  const hasPermission = useCallback((_perm: string) => false, []);

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

  type CommentDTO = {
    id: string;
    postId: string;
    name: string;
    text: string;
    parentId: string | null;
    createdAt: string;
    isOfficial: boolean;
  };
  const loadComments = useCallback(async (postId: string) => {
    const data = await api<{ items: CommentDTO[] }>(
      "/api/posts/" + encodeURIComponent(postId) + "/comments",
    );
    const rows: Comment[] = data.items
      .filter((c) => !c.parentId)
      .map((c) => ({
        id: c.id,
        postId: c.postId,
        author: {
          name: c.name,
          username: "",
          avatar: "/brand/profile.webp",
          isVerifiedBuyer: false,
          isSeller: c.isOfficial,
        },
        text: c.text,
        likes: 0,
        createdAt: c.createdAt,
        replies: data.items
          .filter((r) => r.parentId === c.id)
          .map((r) => ({
            id: r.id,
            authorName: r.name,
            authorAvatar: "/brand/profile.webp",
            isSeller: r.isOfficial,
            text: r.text,
            createdAt: r.createdAt,
          })),
      }));
    setComments((prev) => [
      ...prev.filter((c) => c.postId !== postId),
      ...rows,
    ]);
  }, []);
  useEffect(() => {
    if (!selectedPostId) return;
    let live = true;
    loadComments(selectedPostId).catch((error) => {
      if (live) showToast(error.message, "error");
    });
    return () => {
      live = false;
    };
  }, [selectedPostId, loadComments, showToast]);
  const addComment = useCallback(
    async (postId: string, text: string, replyToCommentId?: string) => {
      if (!text.trim()) return false;
      try {
        await api("/api/posts/" + encodeURIComponent(postId) + "/comments", {
          body: text.trim(),
          ...(replyToCommentId ? { parentId: replyToCommentId } : {}),
          clientMutationId: crypto.randomUUID(),
        });
        await loadComments(postId);
        showToast("دیدگاه در سرور ثبت شد.", "success");
        return true;
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "ثبت دیدگاه ناموفق بود.",
          "error",
        );
        return false;
      }
    },
    [showToast, loadComments],
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
    async (productId: string, color: string, _size: string, qty = 1) => {
      const product = products.find((p) => p.id === productId),
        variant = product?.variantRefs?.find((v) => v.name === color);
      if (!variant) {
        showToast("رنگ معتبر سروری انتخاب نشده است.", "error");
        return;
      }
      try {
        await api("/api/cart", {
          mode: "RETAIL",
          itemId: variant.id,
          quantity: qty,
          requestId: crypto.randomUUID(),
        });
        setCartSheetOpen(true);
        showToast("کالا در سبد سروری ذخیره شد.", "success");
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "افزودن ناموفق بود.",
          "error",
        );
      }
    },
    [products, showToast],
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
    (_productId: string, _packCount: number) => {
      setRoute("wholesale");
      showToast(
        "بستهٔ واقعی و قیمت اختصاصی را از فهرست همکاران انتخاب کنید.",
        "info",
      );
    },
    [setRoute, showToast],
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
    async (
      data: Parameters<StoreContextValue["submitPartnerApplication"]>[0],
    ) => {
      try {
        await api("/api/partner", {
          businessName: data.businessName,
          city: data.city,
          note: data.note,
        });
        setCustomer((prev) => ({
          ...prev,
          partnerStatus: "PENDING",
          businessName: data.businessName,
        }));
        showToast(
          "درخواست در سرور ثبت شد؛ تأیید پشتیبانی لازم است.",
          "success",
        );
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "ثبت درخواست ناموفق بود.",
          "error",
        );
      }
    },
    [showToast],
  );

  // No fake delivery receipts or local support impersonation.
  const sendDirectMessage = useCallback(
    (
      _threadId: string,
      _text: string,
      _sender: "customer" | "support" | "bot",
      _options?: {
        isInternalNote?: boolean;
        productIdAttachment?: string;
        orderCodeAttachment?: string;
      },
    ) => {
      showToast(
        "پیام‌رسان هنوز متصل نیست؛ پیامی برای پشتیبانی ارسال نشد.",
        "warning",
      );
    },
    [showToast],
  );
  const triggerBotQuickAction = useCallback(
    (_action: string) => {
      showToast(
        "ربات هنوز متصل نیست؛ برای سفارش‌ها به حساب مشتری مراجعه کنید.",
        "warning",
      );
    },
    [showToast],
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
    catalogState,
    catalogError,
    reloadCatalog,
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
    openServerCart,
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
