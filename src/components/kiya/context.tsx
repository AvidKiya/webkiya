"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  cartTotal,
  validCart,
  type CartItem,
  type Product,
} from "@/lib/catalog";
import { usePreviewStore, usePreviewTheme } from "@/lib/preview-store";

type ToastKind = "success" | "info" | "warning" | "error";
type Toast = { message: string; kind: ToastKind } | null;

type KiyaContextValue = {
  products: Product[];
  cart: CartItem[];
  cartCount: number;
  subtotal: string;
  liked: string[];
  saved: string[];
  theme: "light" | "dark";
  toggleTheme: () => void;
  addToCart: (product: Product, color: string) => void;
  setQuantity: (item: CartItem, delta: number) => void;
  removeItem: (item: CartItem) => void;
  toggleLiked: (id: string) => void;
  toggleSaved: (id: string) => void;
  storageWarning: boolean;
  offline: boolean;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  postId: string | null;
  openPost: (id: string | null) => void;
  story: string | null;
  openStory: (category: string | null) => void;
  query: string;
  setQuery: (value: string) => void;
  toast: Toast;
  notify: (message: string, kind?: ToastKind) => void;
};

const KiyaContext = createContext<KiyaContextValue | null>(null);

export function KiyaProvider({
  products,
  initialPost,
  initialQuery = "",
  children,
}: {
  products: Product[];
  initialPost?: string;
  initialQuery?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pushed = useRef(false);
  const { data, setData, storageWarning } = usePreviewStore(products);
  const { theme, setTheme } = usePreviewTheme();
  const [cartOpen, setCartOpen] = useState(false);
  const [postId, setPostId] = useState<string | null>(initialPost ?? null);
  const [story, setStory] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [toast, setToast] = useState<Toast>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => {
      const match = window.location.pathname.match(/^\/p\/([^/]+)$/);
      setPostId(match ? decodeURIComponent(match[1]) : null);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const openPost = useCallback(
    (id: string | null) => {
      setPostId(id);
      if (typeof window === "undefined") return;
      const onProductPage = window.location.pathname.startsWith("/p/");
      if (id && !onProductPage) {
        pushed.current = true;
        router.push(`/p/${id}`);
      } else if (!id) {
        if (pushed.current) {
          pushed.current = false;
          router.back();
        } else if (onProductPage) {
          router.push("/");
        }
      }
    },
    [router],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo<KiyaContextValue>(() => {
    const cart = validCart(data.cart, products);
    function notify(message: string, kind: ToastKind = "success") {
      setToast({ message, kind });
    }
    function addToCart(product: Product, color: string) {
      if (!navigator.onLine) {
        notify("برای افزودن به سبد، دوباره به اینترنت وصل شو.", "warning");
        return;
      }
      if (
        product.colors.find((item) => item.name === color)?.available === false
      ) {
        notify("این رنگ فعلاً موجود نیست.", "warning");
        return;
      }
      const current = cart.find(
        (item) => item.productId === product.id && item.color === color,
      );
      if (current && current.qty >= 20) {
        notify("سقف تعداد نمونه ۲۰ عدد است.", "warning");
        return;
      }
      setData((previous) => ({
        ...previous,
        cart: previous.cart.some(
          (item) => item.productId === product.id && item.color === color,
        )
          ? previous.cart.map((item) =>
              item.productId === product.id && item.color === color
                ? { ...item, qty: Math.min(20, item.qty + 1) }
                : item,
            )
          : [...previous.cart, { productId: product.id, color, qty: 1 }],
      }));
      notify("به سبد پیش‌نمایش اضافه شد");
    }
    function setQuantity(item: CartItem, delta: number) {
      setData((previous) => ({
        ...previous,
        cart: previous.cart
          .map((line) =>
            line.productId === item.productId && line.color === item.color
              ? { ...line, qty: Math.min(20, line.qty + delta) }
              : line,
          )
          .filter((line) => line.qty > 0),
      }));
    }
    function removeItem(item: CartItem) {
      setData((previous) => ({
        ...previous,
        cart: previous.cart.filter(
          (line) =>
            !(line.productId === item.productId && line.color === item.color),
        ),
      }));
    }
    function toggleLiked(id: string) {
      setData((previous) => ({
        ...previous,
        liked: previous.liked.includes(id)
          ? previous.liked.filter((value) => value !== id)
          : [...previous.liked, id],
      }));
    }
    function toggleSaved(id: string) {
      setData((previous) => {
        const saved = previous.saved.includes(id)
          ? previous.saved.filter((value) => value !== id)
          : [...previous.saved, id];
        setToast({
          message: saved.includes(id)
            ? "به ذخیره‌شده‌ها اضافه شد"
            : "از ذخیره‌شده‌ها حذف شد",
          kind: "info",
        });
        return { ...previous, saved };
      });
    }

    return {
      products,
      cart,
      cartCount: cart.reduce((sum, item) => sum + item.qty, 0),
      subtotal: cartTotal(cart, products),
      liked: data.liked,
      saved: data.saved,
      theme,
      toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"),
      addToCart,
      setQuantity,
      removeItem,
      toggleLiked,
      toggleSaved,
      storageWarning,
      offline,
      cartOpen,
      setCartOpen,
      postId,
      openPost,
      story,
      openStory: setStory,
      query,
      setQuery,
      toast,
      notify,
    };
  }, [
    products,
    data,
    setData,
    theme,
    setTheme,
    storageWarning,
    offline,
    cartOpen,
    postId,
    query,
    toast,
    openPost,
    story,
  ]);

  return <KiyaContext.Provider value={value}>{children}</KiyaContext.Provider>;
}

export function useKiya() {
  const value = useContext(KiyaContext);
  if (!value) throw new Error("useKiya must be used inside KiyaProvider");
  return value;
}
