import { useState, useEffect } from 'react';
import {
  Sparkles,
  WifiOff,
  Layers,
  ArrowLeft,
  ShieldCheck,
  Truck,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { StoreProvider, useStore } from './context/StoreContext';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/storefront/Header';
import { NavRail } from './components/storefront/NavRail';
import { BottomNav } from './components/storefront/BottomNav';
import { StoriesBar } from './components/storefront/StoriesBar';
import { StoryViewerModal } from './components/storefront/StoryViewerModal';
import { PostCard } from './components/storefront/PostCard';
import { PostModal } from './components/storefront/PostModal';
import { RightRail } from './components/storefront/RightRail';
import { CartSheet } from './components/storefront/CartSheet';
import { CheckoutModal } from './components/storefront/CheckoutModal';
import { ExploreView } from './components/storefront/ExploreView';
import { WholesaleView } from './components/storefront/WholesaleView';
import { StoreProfileView } from './components/storefront/StoreProfileView';
import { DirectInboxView } from './components/storefront/DirectInboxView';
import { KiyaMagView } from './components/storefront/KiyaMagView';
import { AccountOrdersView } from './components/storefront/AccountOrdersView';
import { AdminPanel } from './components/admin/AdminPanel';
import { Toast } from './components/shared/Toast';
import { formatNumber } from './utils/format';

function KiyaAppContent() {
  const { isDark, toggleTheme } = useTheme();
  const {
    viewMode,
    route,
    setRoute,
    posts,
    toast,
    hideToast,
    ordersPaused,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [visiblePostLimit, setVisiblePostLimit] = useState(6);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (viewMode === 'admin') {
    return (
      <>
        <AdminPanel isDark={isDark} onThemeToggle={toggleTheme} />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={hideToast} />
        )}
      </>
    );
  }

  const visiblePosts = posts.slice(0, visiblePostLimit);

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Skip Link for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-buy focus:text-buy-fg font-bold text-xs"
      >
        پرش به محتوای اصلی
      </a>

      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-danger text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>اتصال اینترنت قطع است؛ در حال نمایش محتوای ذخیره‌شده هستید.</span>
        </div>
      )}

      {/* Order Pause Banner if enabled in Admin CMS */}
      {ordersPaused && (
        <div className="bg-warning text-white text-xs font-extrabold px-4 py-2 text-center">
          اطلاعیه فروشگاه کیا: به دلیل انبارگردانی دوره‌ای، ثبت سفارش جدید موقتاً غیرفعال است و ویترین در حالت بازدید قرار دارد.
        </div>
      )}

      <Header
        isDark={isDark}
        onThemeToggle={toggleTheme}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* 3-Column Storefront Shell */}
      <div className="max-w-[1440px] w-full mx-auto px-0 md:px-4 lg:px-6 py-3 md:py-5 pb-24 md:pb-10 flex-1">
        <div className="flex gap-5 items-start justify-center">
          {/* Column 1 (Right in RTL): Sticky Navigation Rail */}
          <NavRail />

          {/* Column 2 (Center): Dynamic Route Canvas */}
          <main id="main-content" className="flex-1 min-w-0">
            {route === 'feed' && (
              <div className="w-full max-w-[630px] mx-auto space-y-4 md:space-y-6">
                <div className="px-3 md:px-0">
                  <StoriesBar />
                </div>

                <div className="flex items-center justify-between px-4 md:px-1">
                  <h1 className="font-extrabold text-sm md:text-base text-ink-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gold-500" />
                    <span>فید زنده کیا — هر روز جدید، بدون واسطه</span>
                  </h1>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => setRoute('explore')}
                      className="text-brand-500 font-bold hover:underline"
                    >
                      نمای گرید فروشگاهی
                    </button>
                  </div>
                </div>

                {visiblePosts.map((post, idx) => (
                  <div key={post.id} className="space-y-4 md:space-y-6">
                    <PostCard post={post} />

                    {/* In-Feed Editorial & Wholesale Insert after 3rd Post (per Doc 03 §2) */}
                    {idx === 2 && (
                      <div className="mx-3 md:mx-0 rounded-2xl bg-gradient-to-l from-[#482780] via-[#381C68] to-[#211A2B] text-white p-5 shadow-e2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gold-500 text-[#211A2B]">
                            <Layers className="w-3 h-3" />
                            ویژه همکاران سراسر کشور
                          </span>
                          <h2 className="font-black text-base">
                            خرید عمده جینی مستقیم از انبار کیا — حداقل سفارش فقط ۱ جین!
                          </h2>
                          <p className="text-xs text-white/80">
                            بدون حداقل مبلغ اضافه · ترکیب شفاف سایز و رنگ هر بسته · حفظ کامل محرمانگی قیمت همکار
                          </p>
                        </div>
                        <button
                          onClick={() => setRoute('wholesale')}
                          className="px-4 py-2.5 rounded-xl bg-white text-[#211A2B] font-extrabold text-xs flex items-center gap-1.5 shrink-0"
                        >
                          <span>ورود به بخش عمده</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {visiblePostLimit < posts.length && (
                  <div className="text-center py-2 px-3">
                    <button
                      onClick={() => setVisiblePostLimit((n) => n + 6)}
                      className="px-6 py-2.5 rounded-xl bg-surface border border-border text-xs font-extrabold text-ink-800 hover:bg-brand-50 transition-colors shadow-e1"
                    >
                      نمایش پست‌های بیشتر ({formatNumber(posts.length - visiblePostLimit)} پست باقی‌مانده)
                    </button>
                  </div>
                )}

                {/* Storefront Footer Strip */}
                <footer className="px-3 md:px-0 pt-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { icon: ShieldCheck, title: 'تک‌فروشنده رسمی', desc: 'تضمین اصالت و سلامت' },
                      { icon: Truck, title: 'ارسال سریع', desc: 'پیک تهران و پیشتاز' },
                      { icon: RotateCcw, title: '۷ روز ضمانت', desc: 'طبق ضوابط بهداشتی کالا' },
                      { icon: BookOpen, title: 'مجله کیامگ', desc: 'راهنمای تخصصی استایل' },
                    ].map((f) => {
                      const Icon = f.icon;
                      return (
                        <div
                          key={f.title}
                          className="bg-surface rounded-2xl border border-border p-3 flex items-center gap-2.5"
                        >
                          <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-ink-900 truncate">{f.title}</p>
                            <p className="text-[10px] text-ink-500 truncate">{f.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-center text-[11px] text-ink-400 space-y-1.5 pb-2">
                    <p>
                      کیا — <bdi>KIYA</bdi> · <bdi>kiyaco24.ir</bdi> · داده‌های کاتالوگ فعلی نمونهٔ آزمایشی (Demo Seed) هستند
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                      <button onClick={() => setRoute('profile')} className="hover:text-brand-500">
                        درباره و قوانین (پیش‌نویس)
                      </button>
                      <button onClick={() => setRoute('wholesale')} className="hover:text-brand-500">
                        همکاری عمده جینی
                      </button>
                      <button onClick={() => setRoute('inbox')} className="hover:text-brand-500">
                        پشتیبانی دایرکت
                      </button>
                      <button onClick={() => setRoute('mag')} className="hover:text-brand-500">
                        کیامگ
                      </button>
                    </div>
                  </div>
                </footer>
              </div>
            )}

            {route === 'explore' && (
              <div className="px-3 md:px-0">
                <ExploreView
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
            )}

            {route === 'wholesale' && (
              <div className="px-3 md:px-0">
                <WholesaleView />
              </div>
            )}

            {route === 'profile' && (
              <div className="px-3 md:px-0">
                <StoreProfileView />
              </div>
            )}

            {route === 'inbox' && (
              <div className="px-3 md:px-0">
                <DirectInboxView />
              </div>
            )}

            {route === 'mag' && (
              <div className="px-3 md:px-0">
                <KiyaMagView />
              </div>
            )}

            {route === 'account' && (
              <div className="px-3 md:px-0">
                <AccountOrdersView />
              </div>
            )}
          </main>

          {/* Column 3 (Left in RTL): Sticky Cart & Live Activity Rail on Feed */}
          {route === 'feed' && <RightRail />}
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <BottomNav />

      {/* Overlays & Modals */}
      <StoryViewerModal />
      <PostModal />
      <CartSheet />
      <CheckoutModal />
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <KiyaAppContent />
    </StoreProvider>
  );
}
