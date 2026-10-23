import { useState } from "react";
import {
  BadgeCheck,
  MessageCircle,
  Grid3X3,
  ShoppingBag,
  Users,
  Info,
  MapPin,
  Clock,
  ShieldAlert,
  Send,
} from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { brandProfile, logoDark } from "../shared/Logo";
import { CATEGORIES } from "../../data/products";
import { cn } from "../../utils/cn";
import { formatNumber, formatPrice } from "../../utils/format";

export function StoreProfileView() {
  const { posts, products, comments, setSelectedPostId, setRoute } = useStore();
  const [tab, setTab] = useState<"posts" | "products" | "ugc" | "about">(
    "posts",
  );

  const verifiedComments = comments.filter((c) => c.author.isVerifiedBuyer);

  return (
    <div className="w-full max-w-[920px] mx-auto space-y-5">
      {/* Profile Header Card */}
      <div className="bg-surface rounded-3xl border border-border shadow-e1 overflow-hidden">
        <div className="h-32 md:h-40 bg-gradient-to-l from-[#482780] via-[#381C68] to-[#1D0E36] relative flex items-center justify-end px-6">
          <img
            src={logoDark}
            alt="کیا — KIYA"
            className="h-20 md:h-24 object-contain opacity-90"
          />
        </div>

        <div className="px-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 relative z-10">
            <div className="flex items-end gap-3.5">
              <div className="w-22 h-22 md:w-24 md:h-24 rounded-full overflow-hidden ring-4 ring-surface bg-[#482780] shadow-e2 shrink-0">
                <img
                  src={brandProfile}
                  alt="کیا"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg md:text-xl font-black text-ink-900">
                    کیا — KIYA
                  </h1>
                  <BadgeCheck className="w-5 h-5 text-brand-500" />
                </div>
                <p className="text-xs text-ink-500 font-mono">
                  <bdi>@kiyaco24 · kiyaco24.ir</bdi>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRoute("inbox")}
                className="px-4 py-2 rounded-xl bg-buy text-buy-fg text-xs font-extrabold flex items-center gap-1.5 shadow-e1"
              >
                <MessageCircle className="w-4 h-4" />
                <span>پیام در دایرکت</span>
              </button>
              <a
                href="https://t.me/kiyaco24"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-canvas-sunken hover:bg-brand-50 border border-border text-ink-800 text-xs font-bold flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-brand-500" />
                <span>کانال تلگرام</span>
              </a>
            </div>
          </div>

          <p className="text-xs md:text-sm text-ink-700 leading-relaxed mt-4 max-w-2xl">
            هر روز جدید، بدون واسطه · عرضه تخصصی کیف و کیف پول، کفش، کمربند،
            لباس زیر زنانه و مردانه (پلمب بهداشتی)، اکسسوری شخصی، گارد موبایل و
            هدیه شخصی به صورت تکی و عمده جینی همکاران.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mt-4 p-3 rounded-2xl bg-canvas-sunken text-center">
            <div>
              <span className="text-sm md:text-base font-black text-ink-900 block">
                {formatNumber(posts.length)}
              </span>
              <span className="text-[11px] text-ink-500">پست فعال</span>
            </div>
            <div>
              <span className="text-sm md:text-base font-black text-ink-900 block">
                {formatNumber(products.length)}
              </span>
              <span className="text-[11px] text-ink-500">کد کالای سرور</span>
            </div>
            <div>
              <span className="text-sm md:text-base font-black text-ink-900 block">
                —
              </span>
              <span className="text-[11px] text-ink-500">میانگین رضایت</span>
            </div>
            <div>
              <span className="text-sm md:text-base font-black text-ink-900 block">
                ۱ جین
              </span>
              <span className="text-[11px] text-ink-500">حداقل عمده</span>
            </div>
          </div>

          {/* Highlights = Categories */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar mt-4 pt-3 border-t border-border">
            {CATEGORIES.filter((c) => c.slug !== "all").map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setRoute("explore")}
                className="flex flex-col items-center gap-1 shrink-0 w-18 group"
              >
                <div className="w-14 h-14 rounded-full p-0.5 story-ring">
                  <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-[11px] font-extrabold text-brand-600 px-1 text-center">
                    {cat.nameFa.split(" ")[0]}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-ink-700 truncate w-full text-center">
                  {cat.nameFa}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="bg-surface rounded-2xl border border-border p-1.5 grid grid-cols-4 gap-1 text-xs font-extrabold">
        {[
          { id: "posts" as const, label: "پست‌ها", icon: Grid3X3 },
          { id: "products" as const, label: "محصولات", icon: ShoppingBag },
          { id: "ugc" as const, label: "تجربه خریداران", icon: Users },
          { id: "about" as const, label: "درباره و قوانین", icon: Info },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all",
                tab === t.id
                  ? "bg-buy text-buy-fg shadow-e1"
                  : "text-ink-600 hover:bg-canvas-sunken",
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === "posts" && (
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {posts.map((post) => {
            const prod = products.find((p) => p.id === post.productId);
            if (!prod) return null;
            return (
              <button
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className="relative aspect-square rounded-2xl overflow-hidden bg-canvas-sunken border border-border group"
              >
                <img
                  src={prod.images[0]}
                  alt={prod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-extrabold p-2 text-center">
                  {prod.name}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tab === "products" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="bg-surface rounded-2xl border border-border p-3 flex items-center gap-3"
            >
              <img
                src={prod.images[0]}
                alt={prod.name}
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-ink-900 truncate">
                  {prod.name}
                </p>
                <p className="text-[11px] text-ink-500">{prod.categoryName}</p>
                <p className="text-xs font-black text-brand-600 mt-1">
                  {formatPrice(prod.price)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "ugc" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {verifiedComments.map((cm) => {
            const post = posts.find((p) => p.id === cm.postId);
            const prod = post
              ? products.find((pr) => pr.id === post.productId)
              : null;
            return (
              <div
                key={cm.id}
                className="bg-surface rounded-2xl border border-border p-4 flex gap-3 shadow-e1"
              >
                {prod && (
                  <img
                    src={prod.images[0]}
                    alt={prod.name}
                    className="w-20 h-20 rounded-xl object-cover shrink-0"
                  />
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-ink-900">
                      {cm.author.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-success-light text-success">
                      خریدار تأییدشده
                    </span>
                  </div>
                  <p className="text-xs text-ink-700 leading-relaxed">
                    «{cm.text}»
                  </p>
                  {prod && (
                    <p className="text-[11px] text-brand-500 font-semibold">
                      کالا: {prod.name}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "about" && (
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4 text-xs text-ink-700 leading-relaxed">
          <div className="p-3 rounded-xl bg-warning-light border border-warning/30 text-ink-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <span>
              <strong>برچسب پیش‌نویس حقوقی (DRAFT):</strong> متون قوانین، نشانی
              انبار و شرایط بازگشت پیش از اتصال نهایی درگاه تولید باید توسط مالک
              بررسی و تأیید حقوقی شوند. هیچ نماد اعتماد شبیه‌سازی‌شده‌ای تا زمان
              دریافت کد رسمی درج نمی‌گردد.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand-500" />
                اطلاعات ارتباطی رسمی
              </h3>
              <p>دامنه رسمی: kiyaco24.ir</p>
              <p>کانال تلگرام: t.me/kiyaco24</p>
              <p>ربات سفارش و پیگیری: t.me/kiyaco24bot</p>
              <p>اینستاگرام رسمی: instagram.com/kiyaco24</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-extrabold text-sm text-ink-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-500" />
                ضوابط ارسال و مرجوعی کالا
              </h3>
              <p>
                • مهلت تست و تعویض سایز کیف، کفش و کمربند: تا ۷ روز در صورت عدم
                استفاده بیرونی.
              </p>
              <p>
                • ضوابط لباس زیر: به دلیل مسائل بهداشتی، بازگشت تنها پیش از
                بازشدن پلمب بهداشتی اولیه مجاز است؛ در صورت ایراد یا مغایرت
                کالا، حقوق قانونی مشتری کاملاً محفوظ است.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
