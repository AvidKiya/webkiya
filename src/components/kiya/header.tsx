"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Search,
  MessageCircle,
  ShoppingBag,
  Sun,
  Moon,
  Shield,
  Sparkles,
} from "lucide-react";
import { Logo } from "./brand";
import { cn, formatNumber } from "./kit";

/**
 * Header ported from the owner's template («Header.tsx»), minus the demo
 * persona switcher: the shipped site has real accounts, so the marketing strip
 * carries the honest preview notice instead of fake sessions.
 */
export function KiyaHeader({
  theme,
  onToggleTheme,
  query,
  onQueryChange,
  cartCount,
  onOpenCart,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  cartCount: number;
  onOpenCart: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k")
        return;
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="جست‌وجوی محصولات"]',
      );
      if (input) {
        event.preventDefault();
        input.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    router.push(
      query.trim()
        ? `/explore?q=${encodeURIComponent(query.trim())}`
        : "/explore",
    );
  }

  return (
    <div className="sticky top-0 z-50">
      <div className="bg-[#482780] text-white text-[11px] px-3 md:px-6 py-1.5 border-b border-white/10">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-gold-500 text-[#211A2B] font-extrabold text-[10px] shrink-0">
              پیش‌نمایش کیا
            </span>
            <span className="truncate text-white/90">
              خرید تکی و عمدهٔ جینی · پرداخت آنلاین و ارسال هنوز فعال نیست
            </span>
          </div>
          <Link
            href="/progress"
            className="shrink-0 text-white/85 hover:text-white font-bold flex items-center gap-1"
          >
            نقشهٔ تکمیل
          </Link>
        </div>
      </div>

      <header className="h-15 md:h-16 glass border-b border-border">
        <div className="max-w-[1440px] mx-auto h-full px-3 md:px-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-3 text-right group shrink-0"
          >
            <Logo
              isDark={theme === "dark"}
              variant="combo"
              size="sm"
              showTagline
              className="hidden sm:flex"
            />
            <Logo
              isDark={theme === "dark"}
              variant="avatar"
              size="sm"
              className="sm:hidden"
            />
            <div className="hidden xl:block h-8 w-px bg-border" />
            <Logo
              isDark={theme === "dark"}
              variant="wordmark"
              size="sm"
              className="hidden xl:flex"
            />
          </Link>

          <form
            onSubmit={submit}
            className="hidden md:flex flex-1 max-w-lg mx-3"
          >
            <div className="relative w-full">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="search"
                aria-label="جست‌وجوی محصولات"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="جست‌وجو در کیف، کفش، لباس زیر، ساعت، گارد موبایل..."
                className="w-full h-10 pr-10 pl-4 bg-canvas-sunken/80 hover:bg-canvas-sunken focus:bg-surface text-sm text-ink-900 placeholder:text-ink-400 rounded-xl border border-border focus:border-brand-500 transition-all outline-none"
              />
            </div>
          </form>

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <Link
              href="/wholesale"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas-sunken hover:bg-brand-50 text-ink-700 text-xs font-semibold border border-border transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              <span>همکاری عمده</span>
            </Link>

            <button
              type="button"
              onClick={onToggleTheme}
              className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-ink-600 hover:bg-canvas-sunken transition-colors"
              aria-label="تغییر تم روشن و تیره"
              title={theme === "dark" ? "تم روشن" : "تم تیره"}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-gold-400" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <Link
              href="/inbox"
              className={cn(
                "relative w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-colors",
                pathname === "/inbox"
                  ? "bg-brand-50 text-brand-500"
                  : "text-ink-600 hover:bg-canvas-sunken",
              )}
              aria-label="دایرکت و پشتیبانی"
            >
              <MessageCircle className="w-5 h-5" />
            </Link>

            <button
              type="button"
              onClick={onOpenCart}
              className="relative w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-ink-700 hover:bg-canvas-sunken transition-colors"
              aria-label="سبد خرید"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] bg-buy text-buy-fg text-[10px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-surface">
                  {formatNumber(cartCount)}
                </span>
              )}
            </button>

            <Link
              href="/admin"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover text-xs font-bold transition-all shadow-e1"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">پنل مدیریت</span>
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
