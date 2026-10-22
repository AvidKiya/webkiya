import { X, ShoppingBag, Layers, Trash2, ArrowLeft } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { cn } from '../../utils/cn';
import { formatPrice, formatNumber } from '../../utils/format';

export function CartSheet() {
  const {
    cartSheetOpen,
    setCartSheetOpen,
    salesMode,
    setSalesMode,
    isApprovedPartner,
    retailCart,
    wholesaleCart,
    products,
    retailSubtotal,
    wholesaleSubtotal,
    updateRetailQty,
    removeFromRetailCart,
    updateWholesalePacks,
    removeFromWholesaleCart,
    setCheckoutOpen,
  } = useStore();

  if (!cartSheetOpen) return null;

  const isWholesale = salesMode === 'WHOLESALE' && isApprovedPartner;

  return (
    <div className="fixed inset-0 z-[115] flex items-end md:items-center justify-center p-0 md:p-4">
      <div
        className="absolute inset-0 bg-[#141018]/65 backdrop-blur-sm"
        onClick={() => setCartSheetOpen(false)}
      />

      <div className="relative w-full max-w-[520px] max-h-[90vh] bg-surface rounded-t-3xl md:rounded-3xl shadow-e4 sheet-in flex flex-col safe-bottom overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isWholesale ? (
              <Layers className="w-5 h-5 text-brand-500" />
            ) : (
              <ShoppingBag className="w-5 h-5 text-brand-500" />
            )}
            <h2 className="font-extrabold text-base text-ink-900">
              {isWholesale ? 'سبد خرید عمده جینی (همکار)' : 'سبد خرید تکی'}
            </h2>
          </div>
          <button
            onClick={() => setCartSheetOpen(false)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-500 hover:bg-canvas-sunken"
            aria-label="بستن سبد"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Separate Carts Switcher for Approved Partner */}
        {isApprovedPartner && (
          <div className="px-5 py-2.5 bg-canvas-sunken border-b border-border flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-600">
              سبد تکی و عمده مستقل‌اند و با جابه‌جایی پاک نمی‌شوند:
            </span>
            <div className="flex gap-1 bg-surface p-0.5 rounded-xl border border-border text-xs font-bold shrink-0">
              <button
                onClick={() => setSalesMode('RETAIL')}
                className={cn(
                  'px-2.5 py-1 rounded-lg',
                  !isWholesale ? 'bg-buy text-buy-fg' : 'text-ink-500'
                )}
              >
                تکی ({formatNumber(retailCart.length)})
              </button>
              <button
                onClick={() => setSalesMode('WHOLESALE')}
                className={cn(
                  'px-2.5 py-1 rounded-lg',
                  isWholesale ? 'bg-buy text-buy-fg' : 'text-ink-500'
                )}
              >
                عمده ({formatNumber(wholesaleCart.length)})
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {isWholesale ? (
            wholesaleCart.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-2">
                <Layers className="w-12 h-12 text-ink-300 mx-auto" />
                <p className="font-extrabold text-ink-800">سبد عمده شما خالی است</p>
                <p className="text-xs text-ink-500">
                  می‌توانید از فید یا بخش «عمده جینی» از حداقل ۱ جین ثبت سفارش کنید.
                </p>
              </div>
            ) : (
              wholesaleCart.map((item) => {
                const prod = products.find((p) => p.id === item.productId);
                if (!prod) return null;
                const pack = prod.packDefinition;
                const linePrice = pack.wholesaleUnitPriceToman * pack.unitsPerPack * item.packCount;
                return (
                  <div key={item.key} className="p-4 flex gap-3">
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-ink-900 line-clamp-1">{prod.name}</h3>
                        <button
                          onClick={() => removeFromWholesaleCart(item.key)}
                          className="text-ink-400 hover:text-danger"
                          aria-label="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-brand-600 font-semibold mt-0.5">
                        {pack.label} · مجموع {formatNumber(item.packCount * pack.unitsPerPack)} واحد
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateWholesalePacks(item.key, item.packCount - 1)}
                            className="w-7 h-7 rounded-lg bg-canvas-sunken font-bold"
                          >
                            −
                          </button>
                          <span className="text-xs font-extrabold">
                            {formatNumber(item.packCount)} جین
                          </span>
                          <button
                            onClick={() => updateWholesalePacks(item.key, item.packCount + 1)}
                            className="w-7 h-7 rounded-lg bg-canvas-sunken font-bold"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-black text-ink-900">
                          {formatPrice(linePrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : retailCart.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-2">
              <ShoppingBag className="w-12 h-12 text-ink-300 mx-auto" />
              <p className="font-extrabold text-ink-800">سبد خرید تکی خالی است</p>
              <p className="text-xs text-ink-500">محصولات مورد علاقه خود را از فید اضافه کنید.</p>
            </div>
          ) : (
            retailCart.map((item) => {
              const prod = products.find((p) => p.id === item.productId);
              if (!prod) return null;
              return (
                <div key={item.key} className="p-4 flex gap-3">
                  <img
                    src={prod.images[0]}
                    alt={prod.name}
                    className="w-20 h-20 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-ink-900 line-clamp-1">{prod.name}</h3>
                      <button
                        onClick={() => removeFromRetailCart(item.key)}
                        className="text-ink-400 hover:text-danger"
                        aria-label="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {item.color} · <bdi className="font-sans">{item.size}</bdi>
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateRetailQty(item.key, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-canvas-sunken font-bold"
                        >
                          −
                        </button>
                        <span className="text-xs font-extrabold">
                          {formatNumber(item.quantity)}
                        </span>
                        <button
                          onClick={() => updateRetailQty(item.key, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-canvas-sunken font-bold"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-black text-ink-900">
                        {formatPrice(prod.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {((isWholesale && wholesaleCart.length > 0) || (!isWholesale && retailCart.length > 0)) && (
          <div className="p-4 border-t border-border bg-surface space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-600">جمع سبد فعلی:</span>
              <span className="text-xl font-black text-ink-900">
                {formatPrice(isWholesale ? wholesaleSubtotal : retailSubtotal)}
              </span>
            </div>
            <button
              onClick={() => {
                setCartSheetOpen(false);
                setCheckoutOpen(true);
              }}
              className="w-full py-3.5 rounded-xl bg-buy text-buy-fg hover:bg-buy-hover font-extrabold text-sm flex items-center justify-center gap-2 shadow-e2"
            >
              <span>ادامه جهت تسویه حساب</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
