import { Home, Compass, ShoppingBag, Layers, User } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { cn } from '../../utils/cn';
import { formatNumber } from '../../utils/format';

export function BottomNav() {
  const {
    route,
    setRoute,
    setCartSheetOpen,
    retailCount,
    wholesalePackTotalCount,
    salesMode,
  } = useStore();

  const cartBadge = salesMode === 'WHOLESALE' ? wholesalePackTotalCount : retailCount;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 glass border-t border-border safe-bottom">
      <div className="h-full flex items-center justify-around px-2">
        <button
          onClick={() => setRoute('feed')}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 min-w-[54px]',
            route === 'feed' ? 'text-brand-500 font-bold' : 'text-ink-500'
          )}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">خانه</span>
        </button>

        <button
          onClick={() => setRoute('explore')}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 min-w-[54px]',
            route === 'explore' ? 'text-brand-500 font-bold' : 'text-ink-500'
          )}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">اکسپلور</span>
        </button>

        <button
          onClick={() => setCartSheetOpen(true)}
          className="relative flex flex-col items-center justify-center"
          aria-label="سبد خرید"
        >
          <div className="w-12 h-12 -mt-5 rounded-2xl bg-buy text-buy-fg shadow-e2 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
            {cartBadge > 0 && (
              <span className="absolute -top-6 -left-1 min-w-[18px] h-[18px] bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 ring-2 ring-surface">
                {formatNumber(cartBadge)}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold text-ink-700 mt-0.5">سبد خرید</span>
        </button>

        <button
          onClick={() => setRoute('wholesale')}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 min-w-[54px]',
            route === 'wholesale' ? 'text-brand-500 font-bold' : 'text-ink-500'
          )}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">عمده جینی</span>
        </button>

        <button
          onClick={() => setRoute('account')}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 min-w-[54px]',
            route === 'account' ? 'text-brand-500 font-bold' : 'text-ink-500'
          )}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">حساب من</span>
        </button>
      </div>
    </nav>
  );
}
