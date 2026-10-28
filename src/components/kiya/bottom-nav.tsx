"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, ShoppingBag, Layers, User } from "lucide-react";
import { cn, formatNumber } from "./kit";

export function KiyaBottomNav({
  cartCount,
  onOpenCart,
}: {
  cartCount: number;
  onOpenCart: () => void;
}) {
  const pathname = usePathname();
  const tab = (href: string) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 min-w-[54px]",
      pathname === href ? "text-brand-500 font-bold" : "text-ink-500",
    );

  return (
    <nav
      aria-label="ناوبری موبایل"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 glass border-t border-border safe-bottom"
    >
      <div className="h-full flex items-center justify-around px-2">
        <Link href="/" className={tab("/")}>
          <Home className="w-5 h-5" />
          <span className="text-[10px]">خانه</span>
        </Link>

        <Link href="/explore" className={tab("/explore")}>
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">اکسپلور</span>
        </Link>

        <button
          type="button"
          onClick={onOpenCart}
          className="relative flex flex-col items-center justify-center"
          aria-label="سبد خرید"
        >
          <span className="w-12 h-12 -mt-5 rounded-2xl bg-buy text-buy-fg shadow-e2 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-6 -left-1 min-w-[18px] h-[18px] bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-surface">
                {formatNumber(cartCount)}
              </span>
            )}
          </span>
          <span className="text-[10px] font-semibold text-ink-700 mt-0.5">
            سبد خرید
          </span>
        </button>

        <Link href="/wholesale" className={tab("/wholesale")}>
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">عمده جینی</span>
        </Link>

        <Link href="/account" className={tab("/account")}>
          <User className="w-5 h-5" />
          <span className="text-[10px]">حساب من</span>
        </Link>
      </div>
    </nav>
  );
}
