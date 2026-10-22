"use client";

import Image from "next/image";
import { ServerComments } from "./server-comments";
import { AccountPanel, PartnerPanel } from "./account-panel";
import { usePreviewStore, usePreviewTheme } from "@/lib/preview-store";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  BadgeCheck,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  Compass,
  Heart,
  Home,
  Instagram,
  LayoutGrid,
  Leaf,
  MessageCircle,
  Minus,
  Moon,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Truck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  cartTotal,
  categories,
  faNumber,
  money,
  type CartItem,
  type Product,
} from "@/lib/catalog";

type Modal =
  | { type: "post"; id: string }
  | { type: "partner" }
  | { type: "story"; index: number }
  | { type: "checkout" }
  | null;
const storyItems = [
  { name: "تازه رسیدن", image: "bag", filter: "همه" },
  { name: "کیف و کیف پول", image: "wallet", filter: "کیف و کیف پول" },
  { name: "ساعت و زیورآلات", image: "watch", filter: "ساعت و زیورآلات" },
  { name: "اکسسوری شخصی", image: "glasses", filter: "اکسسوری شخصی" },
  { name: "برای هدیه", image: "lamp", filter: "دکوری و هدیه" },
];

function Dialog({
  children,
  onClose,
  label,
  wide = false,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button,input,a,textarea")?.focus();
    function keys(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        const targets = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]',
        );
        if (!targets?.length) return;
        const first = targets[0],
          last = targets[targets.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", keys);
      prior?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`dialog ${wide ? "wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <button
          className="icon-button close"
          aria-label="بستن"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function Store({
  section,
  initialPost,
  catalog: products,
}: {
  section: string;
  initialPost?: string;
  catalog: Product[];
}) {
  const { data, setData, storageWarning } = usePreviewStore(products);
  const { theme, setTheme } = usePreviewTheme();
  const [category, setCategory] = useState("همه");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");
  const [mode, setMode] = useState<"retail" | "wholesale">(
    section === "wholesale" ? "wholesale" : "retail",
  );
  const [modal, setModal] = useState<Modal>(
    initialPost ? { type: "post", id: initialPost } : null,
  );
  const [toast, setToast] = useState("");
  const [offline, setOffline] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [colorById, setColorById] = useState<Record<string, string>>({});
  const [packCounts, setPackCounts] = useState<Record<string, number>>({});
  const modalFromFeed = useRef(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const check = () => setOffline(!navigator.onLine);
    check();
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    function pop() {
      const id = window.location.pathname.startsWith("/p/")
        ? window.location.pathname.split("/")[2]
        : null;
      setModal(
        id && products.some((p) => p.id === id) ? { type: "post", id } : null,
      );
    }
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [products]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const search = document.querySelector<HTMLInputElement>(
          'input[aria-label="جست‌وجوی محصولات"]',
        );
        if (search && !modal) {
          event.preventDefault();
          search.focus();
        }
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [modal]);

  const cartCount = data.cart.reduce((s, i) => s + i.qty, 0);
  const total = cartTotal(data.cart, products);
  const toggle = (key: "liked" | "saved", id: string) =>
    setData((d) => ({
      ...d,
      [key]: d[key].includes(id)
        ? d[key].filter((i) => i !== id)
        : [...d[key], id],
    }));
  function openPost(id: string) {
    modalFromFeed.current = !window.location.pathname.startsWith("/p/");
    if (modalFromFeed.current) window.history.pushState(null, "", `/p/${id}`);
    setModal({ type: "post", id });
  }
  function closeModal() {
    if (modal?.type === "post") {
      if (modalFromFeed.current) window.history.back();
      else window.history.replaceState(null, "", "/");
    }
    setModal(null);
  }
  function addCart(product: Product) {
    if (mode === "wholesale") {
      setModal({ type: "partner" });
      return;
    }
    if (offline) {
      setToast("برای افزودن به سبد، دوباره به اینترنت وصل شو.");
      return;
    }
    const color =
      colorById[product.id] ||
      product.colors.find((c) => c.available !== false)?.name ||
      product.colors[0].name;
    if (product.colors.find((c) => c.name === color)?.available === false) {
      setToast("این رنگ فعلاً موجود نیست.");
      return;
    }
    const current = data.cart.find(
      (i) => i.productId === product.id && i.color === color,
    );
    if (current && current.qty >= 20) {
      setToast("سقف تعداد نمونه ۲۰ عدد است.");
      return;
    }
    setData((d) => ({
      ...d,
      cart: current
        ? d.cart.map((i) => (i === current ? { ...i, qty: i.qty + 1 } : i))
        : [...d.cart, { productId: product.id, color, qty: 1 }],
    }));
    setToast("به سبد نمونه‌ات اضافه شد");
  }
  function quantity(item: CartItem, delta: number) {
    setData((d) => ({
      ...d,
      cart: d.cart
        .map((i) =>
          i.productId === item.productId && i.color === item.color
            ? { ...i, qty: Math.min(20, i.qty + delta) }
            : i,
        )
        .filter((i) => i.qty > 0),
    }));
  }
  const visible = products
    .filter(
      (p) =>
        (category === "همه" || p.category === category) &&
        (!query || `${p.name} ${p.subtitle} ${p.category}`.includes(query)) &&
        (section !== "saved" || data.saved.includes(p.id)),
    )
    .sort((a, b) =>
      sort === "cheap"
        ? Number(a.price) - Number(b.price)
        : sort === "expensive"
          ? Number(b.price) - Number(a.price)
          : 0,
    );
  const nav = [
    { href: "/", label: "خانه", icon: Home, key: "home" },
    { href: "/explore", label: "کشف و جست‌وجو", icon: Compass, key: "explore" },
    { href: "/saved", label: "ذخیره‌شده‌ها", icon: Bookmark, key: "saved" },
    {
      href: "/wholesale",
      label: "باشگاه همکاران",
      icon: UsersRound,
      key: "wholesale",
    },
    {
      href: "/inbox",
      label: "گفت‌وگو با کیا",
      icon: MessageCircle,
      key: "inbox",
    },
    { href: "/account", label: "حساب من", icon: UserRound, key: "account" },
  ];
  const priceBlock = (p: Product) => (
    <div className="price-block">
      {mode === "retail" ? (
        <>
          {p.previous && <del>{money(p.previous)}</del>}
          <div>
            <strong>{money(p.price)}</strong>
            <span>تومان</span>
          </div>
        </>
      ) : (
        <div>
          <strong className="inquiry-price">استعلام قیمت عمده</strong>
          <span>ویژهٔ همکاران تأییدشده</span>
        </div>
      )}
    </div>
  );
  const colorPicker = (p: Product) => (
    <div className="color-row">
      <span>
        رنگ:{" "}
        <b>
          {colorById[p.id] ||
            p.colors.find((c) => c.available !== false)?.name ||
            p.colors[0].name}
        </b>
      </span>
      <div>
        {p.colors.map((c) => (
          <button
            key={c.name}
            disabled={mode === "retail" && c.available === false}
            title={c.available === false ? c.name + " · ناموجود" : c.name}
            aria-label={`رنگ ${c.name}`}
            aria-pressed={
              (colorById[p.id] ||
                p.colors.find((c) => c.available !== false)?.name ||
                p.colors[0].name) === c.name
            }
            className={`swatch ${(colorById[p.id] || p.colors.find((c) => c.available !== false)?.name || p.colors[0].name) === c.name ? "selected" : ""}`}
            style={{ background: c.hex }}
            onClick={() => setColorById((d) => ({ ...d, [p.id]: c.name }))}
          />
        ))}
      </div>
    </div>
  );
  const cartContents = (full = false) => (
    <>
      {data.cart.length ? (
        data.cart.map((item, index) => {
          const p = products.find((p) => p.id === item.productId)!;
          return (
            <div className="cart-item" key={`${item.productId}-${item.color}`}>
              <Image src={p.image} width={64} height={70} alt={p.subtitle} />
              <div className="cart-item-info">
                <strong>{p.subtitle}</strong>
                <small>{item.color} · خرید تکی</small>
                <b>
                  {money(p.price)} <small>تومان</small>
                </b>
              </div>
              <div className="stepper">
                <button
                  aria-label={`افزایش تعداد ${p.subtitle}`}
                  onClick={() => quantity(item, 1)}
                  disabled={item.qty >= 20}
                >
                  <Plus size={12} />
                </button>
                <span>{faNumber(item.qty)}</span>
                <button
                  aria-label={`کاهش تعداد ${p.subtitle}`}
                  onClick={() => quantity(item, -1)}
                >
                  {item.qty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                </button>
              </div>
              {full && (
                <span className="line-number">{faNumber(index + 1)}</span>
              )}
            </div>
          );
        })
      ) : (
        <div className="empty-cart">
          <div className="bag-illustration">
            <ShoppingBag size={31} strokeWidth={1.3} />
            <span>+</span>
          </div>
          <strong>جای انتخاب‌های تو خالیه</strong>
          <p>از چیزهایی که دوست داری شروع کن.</p>
        </div>
      )}
      {data.cart.length > 0 && (
        <>
          <div className="cart-sum">
            <span>جمع سبد نمونه</span>
            <strong>
              {money(total)} <small>تومان</small>
            </strong>
          </div>
          <button
            className="primary wide-button"
            onClick={() => setModal({ type: "checkout" })}
          >
            بررسی سبد <ArrowLeft size={16} />
          </button>
          <p className="micro centered">ارسال و پرداخت واقعی هنوز فعال نیست.</p>
        </>
      )}
    </>
  );

  return (
    <div className="app" data-demo="true">
      <aside className="sidebar" inert={!!modal}>
        <Link href="/" className="brand">
          <Image
            src={`/brand/logo-${theme === "dark" ? "dark" : "light"}.webp`}
            alt="کیا — KIYA"
            width={105}
            height={63}
            priority
          />
          <span>جزئیات کوچک، استایل تو</span>
        </Link>
        <div className="sidebar-line" />
        <p className="nav-label">دنیای کیا</p>
        <nav aria-label="منوی اصلی">
          {nav.map(({ href, label, icon: Icon, key }) => (
            <Link
              className={`nav-link ${section === key ? "active" : ""}`}
              href={href}
              key={key}
            >
              <Icon size={21} strokeWidth={1.6} />
              <span>{label}</span>
              {key === "inbox" && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <Link
          href="/cart"
          className={`nav-link cart-nav ${section === "cart" ? "active" : ""}`}
        >
          <ShoppingBag size={21} />
          <span>سبد خرید</span>
          {cartCount > 0 && (
            <span className="count">{faNumber(cartCount)}</span>
          )}
        </Link>
        <div className="sidebar-bottom">
          <div className="mini-note">
            <Leaf size={21} />
            <p>
              چیزهای خوب،
              <br />
              <strong>از جزئیات شروع می‌شن.</strong>
            </p>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === "light" ? "حالت تیره" : "حالت روشن"}</span>
            <span className="toggle-track">
              <span />
            </span>
          </button>
          <div className="sidebar-footer">
            <a
              href="https://www.instagram.com/kiyaco24/"
              target="_blank"
              rel="noreferrer"
              aria-label="اینستاگرام کیا"
            >
              <Instagram size={17} />
            </a>
            <a
              href="https://t.me/kiyaco24"
              target="_blank"
              rel="noreferrer"
              aria-label="کانال تلگرام کیا"
            >
              <Send size={16} />
            </a>
            <small>KIYA © ۲۰۲۶</small>
          </div>
        </div>
      </aside>
      <div className="workspace" inert={!!modal}>
        <header className="topbar">
          <div className="breadcrumbs">
            <span>ویترین کیا</span>
            <ChevronLeft size={13} />
            <b>
              {section === "home"
                ? "برای تو"
                : section === "explore"
                  ? "کشف و جست‌وجو"
                  : section === "saved"
                    ? "ذخیره‌شده‌ها"
                    : section === "cart"
                      ? "سبد خرید"
                      : section === "wholesale"
                        ? "باشگاه همکاران"
                        : section === "inbox"
                          ? "گفت‌وگو با کیا"
                          : "حساب من"}
            </b>
          </div>
          <div className="top-actions">
            <button
              className="icon-button mobile-theme"
              aria-label="تغییر حالت روشن و تیره"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link href="/admin" className="admin-login-link">
              ورود مدیر کل
            </Link>
            <Link
              href="/admin/preview"
              className="demo-badge"
              aria-label="نمایش مدیریت (فقط خواندنی)"
            >
              <span /> دیدن مدیریت
            </Link>
            <Link
              href="/cart"
              className="icon-button top-cart"
              aria-label="سبد خرید"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && <i>{faNumber(cartCount)}</i>}
            </Link>
            <Link
              href="/account"
              className="profile-button"
              aria-label="حساب من"
            >
              <UserRound size={18} />
            </Link>
          </div>
        </header>
        {(offline || storageWarning) && (
          <div className="warning" role="status">
            {offline
              ? "اتصال اینترنت قطع است. خرید غیرفعال است؛ محتوای نمونه را می‌توانی ببینی."
              : "ذخیره‌سازی مرورگر در دسترس نیست؛ تغییرات ممکن است پس از بستن صفحه باقی نمانند."}
          </div>
        )}
        <div className="content-grid">
          <main id="main">
            {["home", "explore", "saved", "wholesale"].includes(section) ? (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">A LITTLE MORE YOU</span>
                    <h1>
                      {section === "saved"
                        ? "چیزهایی که دوست داری."
                        : section === "explore"
                          ? "کشفِ انتخاب بعدی تو."
                          : section === "wholesale"
                            ? "با هم، بیشتر بسازیم."
                            : "هر روز، یک کشف تازه."}
                    </h1>
                    <p>
                      {section === "saved"
                        ? "انتخاب‌های خوبت رو همین‌جا نگه می‌داریم."
                        : "از اکسسوری‌های کوچک تا جزئیاتی که استایلت رو می‌سازن."}
                    </p>
                  </div>
                  <div className="heading-spark">
                    <Sparkles size={24} strokeWidth={1.3} />
                  </div>
                </div>
                <div className="browse-bar">
                  <label className="search">
                    <Search size={19} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="دنبال چی می‌گردی؟"
                      aria-label="جست‌وجوی محصولات"
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="پاک کردن جست‌وجو"
                        onClick={() => setQuery("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                    <kbd>⌘ K</kbd>
                  </label>
                  <button
                    className="filter-button"
                    onClick={() => setSort(sort === "cheap" ? "new" : "cheap")}
                    aria-label="مرتب‌سازی قیمت"
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </div>
                {section !== "saved" && (
                  <div className="stories">
                    {storyItems.map((s, index) => (
                      <button
                        className="story"
                        key={s.name}
                        aria-label={s.name}
                        onClick={() => setModal({ type: "story", index })}
                      >
                        <span
                          className={`story-ring ${index === 0 ? "fresh" : ""}`}
                        >
                          <Image
                            src={`/images/${s.image}.webp`}
                            alt=""
                            width={66}
                            height={66}
                          />
                          {index === 0 && (
                            <span className="story-new">جدید</span>
                          )}
                        </span>
                        <span>{s.name}</span>
                      </button>
                    ))}
                    <button
                      className="story all-stories"
                      onClick={() => {
                        setCategory("همه");
                        setQuery("");
                        setToast("همهٔ مجموعه‌های نمونه نمایش داده شدند.");
                      }}
                    >
                      <span className="story-ring">
                        <LayoutGrid size={25} strokeWidth={1.3} />
                      </span>
                      <span>همهٔ مجموعه‌ها</span>
                    </button>
                  </div>
                )}
                {section === "home" && category === "همه" && !query && (
                  <section className="editorial">
                    <div className="editorial-copy">
                      <span className="editorial-label">
                        THE EVERYDAY EDIT <span>✦</span>
                      </span>
                      <h2>
                        جزئیاتِ کوچک،
                        <br />
                        <em>تفاوت‌های بزرگ.</em>
                      </h2>
                      <p>برای خودت. به سبک خودت.</p>
                      <button
                        onClick={() => {
                          setCategory("کیف و کیف پول");
                          document
                            .getElementById("feed-start")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        }}
                      >
                        کشف کالکشن <ArrowUpLeft size={17} />
                      </button>
                    </div>
                    <div className="editorial-image">
                      <Image
                        src="/images/bag.webp"
                        alt="کالکشن کیف و اکسسوری کیا"
                        fill
                        sizes="280px"
                      />
                      <span className="editorial-stamp">
                        KIYA
                        <br />
                        <small>CURATED</small>
                      </span>
                    </div>
                  </section>
                )}
                {section === "wholesale" && (
                  <section className="partner-inline">
                    <UsersRound size={29} />
                    <div>
                      <h2>یک جین، شروع همکاری ماست.</h2>
                      <p>
                        پس از تأیید حساب، قیمت واحد عمده و جین را کنار قیمت تکی
                        می‌بینی. بدون حداقل مبلغ اضافه.
                      </p>
                      <button
                        className="primary"
                        onClick={() => setModal({ type: "partner" })}
                      >
                        درخواست حساب همکار <ArrowLeft size={15} />
                      </button>
                    </div>
                  </section>
                )}
                <div id="feed-start" className="feed-tabs">
                  <div>
                    <button
                      className={sort === "new" ? "selected-tab" : ""}
                      onClick={() => setSort("new")}
                    >
                      برای تو <Sparkles size={14} />
                    </button>
                    <button
                      className={sort === "cheap" ? "selected-tab" : ""}
                      onClick={() => setSort("cheap")}
                    >
                      اقتصادی‌تر
                    </button>
                  </div>
                  <div className="sales-mode">
                    <button
                      className={mode === "retail" ? "selected" : ""}
                      onClick={() => setMode("retail")}
                    >
                      خرید تکی
                    </button>
                    <button
                      className={mode === "wholesale" ? "selected" : ""}
                      onClick={() => setMode("wholesale")}
                    >
                      عمده <UsersRound size={12} />
                    </button>
                  </div>
                </div>
                <div className="category-chips" aria-label="فیلتر دسته‌بندی">
                  {categories.map((c) => (
                    <button
                      className={category === c ? "active" : ""}
                      key={c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {mode === "wholesale" && (
                  <div className="wholesale-notice">
                    <ShieldCheck size={17} />
                    <span>
                      قیمت عمده فقط برای همکار تأییدشده نمایش داده می‌شود.
                    </span>
                    <button onClick={() => setModal({ type: "partner" })}>
                      درخواست همکاری
                    </button>
                  </div>
                )}
                <div
                  className={section === "explore" ? "explore-grid" : "feed"}
                >
                  {visible.map((p) =>
                    section === "explore" ? (
                      <button
                        className="explore-card"
                        key={p.id}
                        onClick={() => openPost(p.id)}
                      >
                        <div>
                          <Image
                            src={p.image}
                            alt={p.subtitle}
                            width={400}
                            height={400}
                          />
                          <span>{p.tag}</span>
                        </div>
                        <small>{p.category}</small>
                        <h2>{p.subtitle}</h2>
                        {mode === "retail" ? (
                          <strong>
                            {money(p.price)} <small>تومان</small>
                          </strong>
                        ) : (
                          <strong>استعلام قیمت عمده</strong>
                        )}
                      </button>
                    ) : (
                      <article className="post" key={p.id}>
                        <header className="post-header">
                          <Image
                            src="/brand/profile.webp"
                            alt=""
                            width={38}
                            height={38}
                          />
                          <div>
                            <b>
                              کیا <BadgeCheck size={15} />
                              <span>KIYA</span>
                            </b>
                            <small>
                              {p.collection} <span>·</span> محصول نمونه
                            </small>
                          </div>
                          <button
                            className="icon-button"
                            aria-label={`جزئیات ${p.subtitle}`}
                            onClick={() => openPost(p.id)}
                          >
                            <MoreHorizontal size={21} />
                          </button>
                        </header>
                        <div className="post-media">
                          <button
                            onClick={() => openPost(p.id)}
                            aria-label={`مشاهدهٔ ${p.subtitle}`}
                          >
                            <Image
                              src={p.image}
                              alt={p.subtitle}
                              width={800}
                              height={800}
                              priority={p.id === "everyday-bag"}
                              sizes="(max-width:767px) 100vw, 620px"
                            />
                          </button>
                          <span className="media-tag">
                            <Sparkles size={12} />
                            {p.tag}
                          </span>
                          <span className="media-counter">۱ / ۱</span>
                          <button
                            className="media-open"
                            onClick={() => openPost(p.id)}
                          >
                            <ShoppingBag size={15} />
                            <span>از نزدیک ببین</span>
                            <ArrowUpLeft size={15} />
                          </button>
                        </div>
                        <div className="post-body">
                          <div className="social-actions">
                            <div>
                              <button
                                aria-label="پسندیدن"
                                aria-pressed={data.liked.includes(p.id)}
                                className={
                                  data.liked.includes(p.id) ? "liked" : ""
                                }
                                onClick={() => toggle("liked", p.id)}
                              >
                                <Heart
                                  size={23}
                                  fill={
                                    data.liked.includes(p.id)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                              <button
                                aria-label={`دیدگاه‌های ${p.subtitle}`}
                                onClick={() => openPost(p.id)}
                              >
                                <MessageCircle size={22} />
                                <span>دیدگاه‌ها</span>
                              </button>
                              <button
                                aria-label="اشتراک‌گذاری"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      `${window.location.origin}/p/${p.id}`,
                                    );
                                    setToast("لینک پست کپی شد.");
                                  } catch {
                                    openPost(p.id);
                                  }
                                }}
                              >
                                <Send size={21} />
                              </button>
                            </div>
                            <button
                              className={
                                data.saved.includes(p.id) ? "bookmarked" : ""
                              }
                              aria-label="ذخیره کردن"
                              aria-pressed={data.saved.includes(p.id)}
                              onClick={() => toggle("saved", p.id)}
                            >
                              <Bookmark
                                size={23}
                                fill={
                                  data.saved.includes(p.id)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                          </div>
                          <h2>{p.name}</h2>
                          <p
                            className={`caption ${expanded.includes(p.id) ? "expanded" : ""}`}
                          >
                            {p.description}
                          </p>
                          <button
                            className="more-text"
                            aria-expanded={expanded.includes(p.id)}
                            onClick={() =>
                              setExpanded((e) =>
                                e.includes(p.id)
                                  ? e.filter((i) => i !== p.id)
                                  : [...e, p.id],
                              )
                            }
                          >
                            {expanded.includes(p.id) ? "کمتر" : "بیشتر بخون"}
                            <ChevronDown size={12} />
                          </button>
                          {colorPicker(p)}
                          <div className="buy-row">
                            {priceBlock(p)}
                            <button
                              className="primary"
                              disabled={
                                offline ||
                                (mode === "retail" &&
                                  p.colors.every((c) => c.available === false))
                              }
                              onClick={() => addCart(p)}
                            >
                              {mode === "retail" ? (
                                <>
                                  <ShoppingBag size={16} />
                                  {p.colors.every((c) => c.available === false)
                                    ? "ناموجود"
                                    : "افزودن به سبد"}
                                </>
                              ) : (
                                <>
                                  <MessageCircle size={16} />
                                  استعلام عمده
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="post-footer">
                          <span>
                            <Package size={13} /> نمونهٔ طراحی؛ قابل خرید واقعی
                            نیست
                          </span>
                          <button onClick={() => openPost(p.id)}>
                            جزئیات و دیدگاه‌ها <ChevronLeft size={13} />
                          </button>
                        </div>
                      </article>
                    ),
                  )}
                </div>
                {!visible.length && (
                  <div className="empty-state">
                    <Search size={32} />
                    <h2>
                      {section === "saved"
                        ? "هنوز چیزی ذخیره نکردی"
                        : "هنوز انتخابی اینجا نیست"}
                    </h2>
                    <p>
                      {section === "saved"
                        ? "روی نشانهٔ ذخیره زیر پست‌ها بزن."
                        : "فیلتر دیگری را امتحان کن؛ این کاتالوگ فعلاً نمونه است."}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setQuery("");
                        setCategory("همه");
                      }}
                    >
                      مشاهدهٔ همه
                    </button>
                  </div>
                )}
                <div className="feed-end">
                  <span>✦</span>
                  <p>تا اینجا، همهٔ انتخاب‌های نمونه رو دیدی.</p>
                  <small>چیزهای خوب بیشتری در راهه.</small>
                </div>
              </>
            ) : section === "cart" ? (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">YOUR LITTLE FINDS</span>
                    <h1>انتخاب‌های تو.</h1>
                    <p>سبد نمونهٔ تکی؛ بدون پرداخت واقعی</p>
                  </div>
                  <ShoppingBag size={28} />
                </div>
                <section className="surface cart-page">
                  {cartContents(true)}
                </section>
                <Link className="text-link" href="/">
                  ادامهٔ کشف در ویترین <ArrowLeft size={16} />
                </Link>
              </>
            ) : section === "inbox" ? (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">LET’S TALK</span>
                    <h1>ما اینجاییم، برای تو.</h1>
                    <p>سؤالی دربارهٔ خرید یا همکاری داری؟</p>
                  </div>
                  <MessageCircle size={28} />
                </div>
                <section className="surface support-page">
                  <div className="support-avatar">
                    <Image
                      src="/brand/profile.webp"
                      alt="کیا"
                      width={74}
                      height={74}
                    />
                  </div>
                  <h2>گفت‌وگو با تیم کیا</h2>
                  <p>
                    صندوق پیام داخلی در مرحلهٔ بعد ساخته می‌شود. فعلاً می‌توانی
                    از مسیرهای عمومی زیر با کیا در ارتباط باشی؛ این صفحه هیچ
                    پیام واقعی ارسال نمی‌کند.
                  </p>
                  <a
                    className="primary"
                    href="https://t.me/kiyaco24bot"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Send size={17} /> باز کردن ربات در تلگرام
                  </a>
                  <a
                    className="secondary"
                    href="https://www.instagram.com/kiyaco24/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Instagram size={17} /> صفحهٔ اینستاگرام
                  </a>
                </section>
              </>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">YOUR KIYA</span>
                    <h1>یک جای کوچک، برای تو.</h1>
                    <p>حساب مشتری و سفارش‌های من</p>
                  </div>
                  <UserRound size={28} />
                </div>
                <AccountPanel />
                <section className="surface support-page">
                  <h2>همکاری با کیا</h2>
                  <PartnerPanel showLogin={false} />
                </section>
              </>
            )}
          </main>
          <aside className="utility">
            <section className="surface cart-panel">
              <div className="panel-title">
                <div className="title-icon">
                  <ShoppingBag size={18} />
                </div>
                <h2>سبد خوش‌سلیقهٔ تو</h2>
                <span className="small-count">{faNumber(cartCount)}</span>
              </div>
              {cartContents()}
            </section>
            <section className="wholesale-panel">
              <div className="partner-badge">
                <UsersRound size={20} />
              </div>
              <span className="eyebrow">GROW WITH KIYA</span>
              <h2>
                فقط مشتری نباش،
                <br />
                همکار کیا باش.
              </h2>
              <p>قیمت همکاری، خرید جینی و یک شروع تازه؛ حتی با یک جین.</p>
              <button onClick={() => setModal({ type: "partner" })}>
                آشنایی با خرید عمده <ArrowUpLeft size={17} />
              </button>
              <div className="orb orb-one" />
              <div className="orb orb-two" />
            </section>
            <section className="curated-panel">
              <div className="panel-heading">
                <h2>کوچک، دوست‌داشتنی</h2>
                <Sparkles size={16} />
              </div>
              <p>شاید انتخاب بعدی تو اینجا باشه.</p>
              {products.slice(1, 4).map((p) => (
                <button
                  className="suggestion"
                  key={p.id}
                  onClick={() => openPost(p.id)}
                >
                  <Image src={p.image} alt="" width={52} height={58} />
                  <div>
                    <strong>{p.subtitle}</strong>
                    <small>
                      {mode === "retail"
                        ? `${money(p.price)} تومان`
                        : "استعلام عمده"}
                    </small>
                  </div>
                  <ArrowUpLeft size={16} />
                </button>
              ))}
            </section>
            <section className="trust-strip">
              <span>
                <Truck size={18} />
                اطلاعات ارسال
              </span>
              <span>
                <ShieldCheck size={18} />
                خرید شفاف
              </span>
              <p>جزئیات ارسال و مرجوعی پیش از فعال‌شدن فروش، تکمیل می‌شود.</p>
            </section>
            <footer className="utility-footer">
              <span>دربارهٔ این نسخه</span>
              <p>
                نسخهٔ ۰.۴ · مدیریت واقعی تیم و دسترسی
                <br />
                فروش و پرداخت واقعی فعال نیست.
              </p>
              <b>
                KIYA <span>—</span> MADE FOR YOU
              </b>
            </footer>
          </aside>
        </div>
      </div>
      <nav inert={!!modal} className="mobile-nav" aria-label="ناوبری موبایل">
        {[nav[0], nav[1], nav[2], nav[4]].map(
          ({ href, label, icon: Icon, key }) => (
            <Link
              key={key}
              href={href}
              className={section === key ? "active" : ""}
            >
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          ),
        )}
        <Link href="/cart" className={section === "cart" ? "active" : ""}>
          <ShoppingBag size={22} />
          <span>سبد {cartCount ? faNumber(cartCount) : ""}</span>
        </Link>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal?.type === "post" &&
        (() => {
          const p = products.find((i) => i.id === modal.id)!;
          return (
            <Dialog wide label={`جزئیات ${p.subtitle}`} onClose={closeModal}>
              <div className="post-dialog">
                <div className="dialog-photo">
                  <Image
                    src={p.image}
                    alt={p.subtitle}
                    width={800}
                    height={800}
                    sizes="(max-width:767px) 100vw, 55vw"
                  />
                  <span className="photo-label">KIYA / {p.collection}</span>
                </div>
                <div className="dialog-info">
                  <span className="eyebrow">KIYA EDIT</span>
                  <h2>{p.subtitle}</h2>
                  <p className="dialog-description">{p.description}</p>
                  {colorPicker(p)}
                  {mode === "wholesale" && (
                    <div className="pack-info">
                      <Package size={19} />
                      <span>
                        هر جین نمونه: {faNumber(p.packSize)} عدد · حداقل یک جین
                      </span>
                      <div className="pack-preview">
                        <span>تعداد جین برای استعلام</span>
                        <div className="stepper">
                          <button
                            aria-label="کاهش تعداد جین"
                            disabled={(packCounts[p.id] || 1) <= 1}
                            onClick={() =>
                              setPackCounts((counts) => ({
                                ...counts,
                                [p.id]: Math.max(1, (counts[p.id] || 1) - 1),
                              }))
                            }
                          >
                            <Minus size={13} />
                          </button>
                          <b>{faNumber(packCounts[p.id] || 1)}</b>
                          <button
                            aria-label="افزایش تعداد جین"
                            disabled={(packCounts[p.id] || 1) >= 20}
                            onClick={() =>
                              setPackCounts((counts) => ({
                                ...counts,
                                [p.id]: Math.min(20, (counts[p.id] || 1) + 1),
                              }))
                            }
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <small>
                          مجموع نمونه:{" "}
                          {faNumber((packCounts[p.id] || 1) * p.packSize)} عدد ·
                          بدون ثبت سفارش
                        </small>
                      </div>
                    </div>
                  )}
                  <div className="buy-row">
                    {priceBlock(p)}
                    <button
                      className="primary"
                      disabled={
                        offline ||
                        (mode === "retail" &&
                          p.colors.every((c) => c.available === false))
                      }
                      onClick={() => addCart(p)}
                    >
                      {mode === "retail"
                        ? p.colors.every((c) => c.available === false)
                          ? "ناموجود"
                          : "افزودن به سبد"
                        : "درخواست همکاری"}
                      <ShoppingBag size={16} />
                    </button>
                  </div>
                  <details>
                    <summary>
                      مشخصات، ارسال و مرجوعی <ChevronDown size={15} />
                    </summary>
                    <p>
                      {p.isDemo
                        ? "محصول و قیمت نمونه‌اند. "
                        : "این کالا توسط مدیریت ثبت شده است. "}{" "}
                      جنس دقیق، ابعاد، شرایط گارانتی، هزینهٔ ارسال و مرجوعی باید
                      پیش از شروع فروش واقعی تأیید شوند. سفارش آنلاین هنوز فعال
                      نیست.
                    </p>
                  </details>
                  <ServerComments postId={p.id} />
                </div>
              </div>
            </Dialog>
          );
        })()}
      {modal?.type === "partner" && (
        <Dialog label="حساب همکار کیا" onClose={closeModal}>
          <div className="partner-dialog">
            <div className="large-symbol">
              <UsersRound size={30} />
            </div>
            <span className="eyebrow">GROW WITH KIYA</span>
            <h2>شروع همکاری، از یک جین.</h2>
            <p>
              در مسیر نهایی، پس از تأیید حساب توسط پشتیبانی قیمت عمدهٔ اختصاصی
              در دسترس خواهد بود. قیمت‌گذاری عمده هنوز فعال نیست. حداقل خرید یک
              جینه؛ بدون حداقل مبلغ اضافه.
            </p>
            <ul>
              <li>
                <Check size={16} />
                خرید جینی با ترکیب مشخص رنگ و مدل
              </li>
              <li>
                <Check size={16} />
                حساب مشتری مستقل از پنل مدیریت
              </li>
              <li>
                <Check size={16} />
                قیمت اختصاصی فقط پس از تأیید واقعی
              </li>
            </ul>
            <PartnerPanel />
            <a
              className="text-link"
              href="https://t.me/kiyaco24bot"
              target="_blank"
              rel="noreferrer"
            >
              ارتباط مستقیم از طریق تلگرام <ArrowUpLeft size={16} />
            </a>
          </div>
        </Dialog>
      )}
      {modal?.type === "story" && (
        <Dialog
          label={`مجموعهٔ ${storyItems[modal.index].name}`}
          onClose={closeModal}
        >
          <div className="story-dialog">
            <div className="story-progress">
              {storyItems.map((_, i) => (
                <span className={i <= modal.index ? "seen" : ""} key={i} />
              ))}
            </div>
            <Image
              src={`/images/${storyItems[modal.index].image}.webp`}
              alt={storyItems[modal.index].name}
              width={800}
              height={800}
            />
            <div className="story-copy">
              <span className="eyebrow">KIYA COLLECTIONS</span>
              <h2>{storyItems[modal.index].name}</h2>
              <button
                className="primary"
                onClick={() => {
                  setCategory(storyItems[modal.index].filter);
                  setModal(null);
                }}
              >
                دیدن این مجموعه <ArrowLeft size={16} />
              </button>
              <button
                className="story-next"
                onClick={() =>
                  setModal({
                    type: "story",
                    index: (modal.index + 1) % storyItems.length,
                  })
                }
              >
                مجموعهٔ بعدی <ChevronLeft size={15} />
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {modal?.type === "checkout" && (
        <Dialog label="بررسی سبد نمونه" onClose={closeModal}>
          <div className="partner-dialog">
            <div className="large-symbol">
              <ShoppingBag size={29} />
            </div>
            <h2>سبدت برای بررسی طرح آماده‌ست.</h2>
            <p>
              جمع اقلام نمونه: <strong>{money(total)} تومان</strong>
            </p>
            <div className="demo-callout">
              این نسخه به درگاه، انبار و حساب واقعی وصل نیست. مبلغی دریافت
              نمی‌شود و سفارشی ثبت نخواهد شد. در مرحلهٔ بعد quote سمت سرور، ورود
              و رزرو موجودی اضافه می‌شود.
            </div>
            <button className="primary wide-button" onClick={closeModal}>
              متوجه شدم، ادامهٔ بررسی
            </button>
            <Link className="text-link" href="/cart">
              مشاهدهٔ صفحهٔ سبد <ArrowLeft size={16} />
            </Link>
          </div>
        </Dialog>
      )}
    </div>
  );
}
