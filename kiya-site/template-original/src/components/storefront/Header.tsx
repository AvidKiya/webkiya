import {
  Search,
  MessageCircle,
  ShoppingBag,
  Sun,
  Moon,
  Shield,
  Layers,
  UserCheck,
  Clock,
  User,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../shared/Logo';
import { useStore } from '../../context/StoreContext';
import { formatNumber } from '../../utils/format';
import { cn } from '../../utils/cn';

interface HeaderProps {
  isDark: boolean;
  onThemeToggle: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function Header({ isDark, onThemeToggle, searchQuery, onSearchChange }: HeaderProps) {
  const {
    setViewMode,
    route,
    setRoute,
    setCartSheetOpen,
    retailCount,
    wholesalePackTotalCount,
    salesMode,
    setSalesMode,
    isApprovedPartner,
    customer,
    switchDemoPersona,
    directThreads,
    announcementBanner,
  } = useStore();

  const unreadInbox = directThreads.reduce((s, t) => s + t.unreadCount, 0);
  const activeCartBadge = salesMode === 'WHOLESALE' ? wholesalePackTotalCount : retailCount;

  return (
    <div className="sticky top-0 z-50">
      {/* Top Announcement + Demo Persona Bar */}
      <div className="bg-[#482780] text-white text-[11px] px-3 md:px-6 py-1.5 border-b border-white/10">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-gold-500 text-[#211A2B] font-extrabold text-[10px] shrink-0">
              DEMO SEED
            </span>
            <span className="truncate text-white/90">{announcementBanner}</span>
          </div>

          {/* Quick Persona Switcher for testing Retail vs Approved Partner */}
          <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 shrink-0">
            <span className="text-[10px] text-white/75 px-1.5 hidden sm:inline">نقش آزمایشی خریدار:</span>
            <button
              onClick={() => switchDemoPersona('guest')}
              className={cn(
                'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1',
                customer.partnerStatus === 'NONE'
                  ? 'bg-white text-[#211A2B] shadow-sm'
                  : 'text-white/85 hover:bg-white/10'
              )}
            >
              <User className="w-3 h-3" />
              مشتری عادی
            </button>
            <button
              onClick={() => switchDemoPersona('pending')}
              className={cn(
                'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1',
                customer.partnerStatus === 'PENDING'
                  ? 'bg-amber-300 text-[#211A2B] shadow-sm'
                  : 'text-white/85 hover:bg-white/10'
              )}
            >
              <Clock className="w-3 h-3" />
              در انتظار تأیید
            </button>
            <button
              onClick={() => switchDemoPersona('approved')}
              className={cn(
                'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1',
                customer.partnerStatus === 'APPROVED'
                  ? 'bg-emerald-400 text-[#141018] shadow-sm'
                  : 'text-white/85 hover:bg-white/10'
              )}
            >
              <UserCheck className="w-3 h-3" />
              همکار تأییدشده (عمده)
            </button>
          </div>
        </div>
      </div>

      {/* Main Glass Header */}
      <header className="h-15 md:h-16 glass border-b border-border">
        <div className="max-w-[1440px] mx-auto h-full px-3 md:px-6 flex items-center justify-between gap-3">
          {/* Right: Official Brand Logo */}
          <button
            onClick={() => setRoute('feed')}
            className="flex items-center gap-3 text-right focus:outline-none group"
          >
            <Logo isDark={isDark} variant="combo" size="sm" showTagline />
            <div className="hidden xl:block h-8 w-[1px] bg-border" />
            <Logo isDark={isDark} variant="wordmark" size="sm" className="hidden xl:flex" />
          </button>

          {/* Center: Smart Search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-3">
            <div className="relative w-full">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (route !== 'explore') setRoute('explore');
                }}
                placeholder="جست‌وجو در کیف، کفش، لباس زیر، ساعت، گارد موبایل..."
                className="w-full h-10 pr-10 pl-4 bg-canvas-sunken/80 hover:bg-canvas-sunken focus:bg-surface text-sm text-ink-900 placeholder:text-ink-400 rounded-xl border border-border focus:border-brand-500 transition-all outline-none"
              />
            </div>
          </div>

          {/* Left: Mode Toggle + Actions */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Retail / Wholesale Mode Switch */}
            {isApprovedPartner ? (
              <div className="flex items-center bg-canvas-sunken border border-border rounded-xl p-0.5">
                <button
                  onClick={() => setSalesMode('RETAIL')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                    salesMode === 'RETAIL'
                      ? 'bg-surface text-ink-900 shadow-e1'
                      : 'text-ink-500 hover:text-ink-800'
                  )}
                >
                  تکی
                </button>
                <button
                  onClick={() => setSalesMode('WHOLESALE')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                    salesMode === 'WHOLESALE'
                      ? 'bg-buy text-buy-fg shadow-e1'
                      : 'text-ink-500 hover:text-ink-800'
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  عمده جینی
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRoute('wholesale')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas-sunken hover:bg-brand-50 text-ink-700 text-xs font-semibold border border-border transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-gold-500" />
                <span>همکاری عمده</span>
              </button>
            )}

            {/* Theme Switch */}
            <button
              onClick={onThemeToggle}
              className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-ink-600 hover:bg-canvas-sunken transition-colors"
              aria-label="تغییر تم روشن و تیره"
              title={isDark ? 'تم روشن' : 'تم تیره'}
            >
              {isDark ? <Sun className="w-5 h-5 text-gold-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Direct Inbox */}
            <button
              onClick={() => setRoute('inbox')}
              className={cn(
                'relative w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-colors',
                route === 'inbox'
                  ? 'bg-brand-50 text-brand-500'
                  : 'text-ink-600 hover:bg-canvas-sunken'
              )}
              aria-label="دایرکت و پشتیبانی"
            >
              <MessageCircle className="w-5 h-5" />
              {unreadInbox > 0 && (
                <span className="absolute top-1 left-1 min-w-[17px] h-[17px] bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-surface">
                  {formatNumber(unreadInbox)}
                </span>
              )}
            </button>

            {/* Cart Sheet Trigger */}
            <button
              onClick={() => setCartSheetOpen(true)}
              className="relative w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-ink-700 hover:bg-canvas-sunken transition-colors"
              aria-label="سبد خرید"
            >
              <ShoppingBag className="w-5 h-5" />
              {activeCartBadge > 0 && (
                <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] bg-buy text-buy-fg text-[10px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-surface">
                  {formatNumber(activeCartBadge)}
                </span>
              )}
            </button>

            {/* Admin Command Center Button */}
            <button
              onClick={() => setViewMode('admin')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover text-xs font-bold transition-all shadow-e1"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">پنل مدیریت</span>
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}
