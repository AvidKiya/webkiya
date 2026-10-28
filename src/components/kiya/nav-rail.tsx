"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  Layers,
  Store,
  MessageCircle,
  BookOpen,
  Wallet,
  Send,
  Camera,
  BadgeCheck,
  Bookmark,
} from "lucide-react";
import { brandProfile } from "./brand";
import { cn } from "./kit";

const items = [
  { href: "/", label: "فید زنده و فروشگاه", icon: Home },
  { href: "/explore", label: "اکسپلور و فروشگاه", icon: Compass },
  {
    href: "/wholesale",
    label: "عمده جینی و همکاری",
    icon: Layers,
    badge: "۱ جین",
    highlight: true,
  },
  { href: "/saved", label: "ذخیره‌شده‌ها", icon: Bookmark },
  { href: "/profile", label: "پروفایل @kiyaco24", icon: Store },
  { href: "/inbox", label: "دایرکت و پشتیبانی", icon: MessageCircle },
  { href: "/mag", label: "مجله کیامگ", icon: BookOpen },
  { href: "/account", label: "سفارش‌ها و حساب", icon: Wallet },
];

export function KiyaNavRail({ inert = false }: { inert?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      inert={inert}
      className="hidden md:flex flex-col w-[76px] xl:w-[244px] shrink-0 sticky top-[104px] space-y-4 self-start"
    >
      <div className="bg-surface rounded-2xl border border-border p-2.5 shadow-e1">
        <div className="hidden xl:block text-[11px] font-bold text-ink-400 px-3 py-1.5">
          ناوبری فروشگاه
        </div>
        <nav aria-label="ناوبری فروشگاه" className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "w-full flex items-center justify-center xl:justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all relative",
                  active
                    ? "bg-buy text-buy-fg shadow-e1"
                    : item.highlight
                      ? "text-ink-800 hover:bg-brand-50 border border-dashed border-brand-200"
                      : "text-ink-600 hover:text-ink-900 hover:bg-canvas-sunken",
                )}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="hidden xl:inline truncate">
                    {item.label}
                  </span>
                </span>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[10px] font-extrabold rounded-full px-1.5 py-0.5 xl:static absolute top-1 left-1",
                      active
                        ? "bg-white/20 text-current"
                        : "bg-gold-400/25 text-gold-text",
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="hidden xl:block bg-surface rounded-2xl border border-border p-4 shadow-e1">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#482780] border border-gold-500/40 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandProfile}
              alt="کیا"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-bold text-xs text-ink-900">
              <span>کیا — KIYA</span>
              <BadgeCheck className="w-4 h-4 text-brand-500 shrink-0" />
            </div>
            <p className="text-[11px] text-ink-500 truncate">
              <bdi>kiyaco24.ir</bdi>
            </p>
          </div>
        </div>
        <p className="text-xs text-ink-600 leading-relaxed mb-3">
          تک‌فروشنده تخصصی کیف، کفش، کمربند، لباس زیر و اکسسوری شخصی با فروش تکی
          و عمده جینی.
        </p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <a
            href="https://t.me/kiyaco24"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-canvas-sunken hover:bg-brand-50 text-ink-700 font-semibold transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-brand-500" />
            <span>کانال تلگرام</span>
          </a>
          <a
            href="https://www.instagram.com/kiyaco24/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-canvas-sunken hover:bg-brand-50 text-ink-700 font-semibold transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-brand-500" />
            <span>اینستاگرام</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
