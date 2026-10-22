import { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  Share2,
  MessageSquare,
  DollarSign,
  Shield,
  PlugZap,
  Store,
  Sun,
  Moon,
  Menu,
  X,
  Plus,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Lock,
  Send,
  AlertTriangle,
  Edit3,
  Layers,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  ROLE_DEFINITIONS,
  WEEKLY_SALES_FA,
  INTEGRATION_RECORDS,
} from '../../data/admin';
import type { AdminRoleKey, OrderStatus, Product } from '../../types';
import { Logo } from '../shared/Logo';
import { cn } from '../../utils/cn';
import {
  formatPrice,
  formatNumber,
  formatJalaliDateTime,
} from '../../utils/format';

type AdminTab =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'partners'
  | 'social'
  | 'support'
  | 'finance'
  | 'rbac'
  | 'integrations';

interface AdminPanelProps {
  isDark: boolean;
  onThemeToggle: () => void;
}

const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badgeClass: string }
> = {
  pending: { label: 'در انتظار پرداخت/بررسی', badgeClass: 'bg-warning-light text-warning' },
  confirmed: { label: 'تأیید پرداخت', badgeClass: 'bg-info-light text-info' },
  preparing: { label: 'در حال آماده‌سازی انبار', badgeClass: 'bg-brand-50 text-brand-600' },
  shipped: { label: 'تحویل به پست/پیک', badgeClass: 'bg-info-light text-info' },
  delivered: { label: 'تحویل‌شده', badgeClass: 'bg-success-light text-success' },
  cancelled: { label: 'لغوشده', badgeClass: 'bg-danger-light text-danger' },
};

export function AdminPanel({ isDark, onThemeToggle }: AdminPanelProps) {
  const {
    setViewMode,
    activeAdminRole,
    setActiveAdminRole,
    hasPermission,
    products,
    orders,
    partnerApplications,
    stockLedger,
    auditLogs,
    directThreads,
    walletEntries,
    adjustStock,
    reviewPartnerApp,
    updateOrderStatus,
    saveProductChanges,
    createSocialPostFromProduct,
    sendDirectMessage,
    announcementBanner,
    setAnnouncementBanner,
    ordersPaused,
    setOrdersPaused,
    showToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Undo state for stock adjustment
  const [lastStockUndo, setLastStockUndo] = useState<{
    productId: string;
    sku: string;
    inverseDelta: number;
  } | null>(null);

  // Product editor modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Order filter
  const [orderModeFilter, setOrderModeFilter] = useState<'ALL' | 'RETAIL' | 'WHOLESALE'>('ALL');

  // Partner review reason
  const [partnerReason, setPartnerReason] = useState('');

  // SocialHub composer
  const [socialProductId, setSocialProductId] = useState(products[0]?.id || 'prod-001');
  const [socialCaption, setSocialCaption] = useState(
    'شارژ مجدد از کارگاه کیا با تضمین کیفیت دوخت و ارسال سریع به سراسر ایران.'
  );
  const [socialBadge, setSocialBadge] = useState('پیشنهاد امروز');

  // Support thread reply
  const [supportThreadId, setSupportThreadId] = useState(directThreads[1]?.id || 'th-support');
  const [supportReply, setSupportReply] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Nav items filtered by Focus Mode (RBAC permissions)
  const navItems = useMemo(() => {
    const all: {
      id: AdminTab;
      label: string;
      icon: typeof LayoutDashboard;
      requiredPerm: string;
      badge?: number;
    }[] = [
      {
        id: 'dashboard',
        label: 'داشبورد فرماندهی',
        icon: LayoutDashboard,
        requiredPerm: 'dashboard:read',
      },
      {
        id: 'products',
        label: 'محصولات و تعریف جین',
        icon: Package,
        requiredPerm: 'product:read',
        badge: products.length,
      },
      {
        id: 'inventory',
        label: 'انبار و کاردکس کالا',
        icon: Warehouse,
        requiredPerm: 'inventory:read',
        badge: products.filter((p) => p.stock <= p.lowStockThreshold).length || undefined,
      },
      {
        id: 'orders',
        label: 'سفارش‌های تکی و عمده',
        icon: ShoppingCart,
        requiredPerm: 'order:read',
        badge: orders.length,
      },
      {
        id: 'partners',
        label: 'همکاران و سیاست عمده',
        icon: Users,
        requiredPerm: 'partner:read',
        badge: partnerApplications.filter((a) => a.status === 'PENDING').length || undefined,
      },
      {
        id: 'social',
        label: 'SocialHub و ویترین',
        icon: Share2,
        requiredPerm: 'social:publish',
      },
      {
        id: 'support',
        label: 'پشتیبانی و دایرکت',
        icon: MessageSquare,
        requiredPerm: 'support:reply',
      },
      {
        id: 'finance',
        label: 'مالی و دفتر کیف پول',
        icon: DollarSign,
        requiredPerm: 'finance:read',
      },
      {
        id: 'rbac',
        label: 'نقش‌ها (RBAC) و Audit',
        icon: Shield,
        requiredPerm: 'audit:read',
        badge: auditLogs.length,
      },
      {
        id: 'integrations',
        label: 'اتصال‌ها و سلامت سرویس',
        icon: PlugZap,
        requiredPerm: 'dashboard:read',
      },
    ];
    return all.filter((item) => hasPermission(item.requiredPerm));
  }, [hasPermission, products, orders.length, partnerApplications, auditLogs.length]);

  const currentTabValid = navItems.some((i) => i.id === activeTab);
  const resolvedTab: AdminTab = currentTabValid ? activeTab : navItems[0]?.id || 'orders';

  const totalConfirmedSales = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + o.totalToman, 0);
  const lowStockItems = products.filter((p) => p.stock <= p.lowStockThreshold);
  const pendingPartners = partnerApplications.filter((a) => a.status === 'PENDING');
  const approvedPartnersCount = partnerApplications.filter((a) => a.status === 'APPROVED').length;

  const maxChartTotal = Math.max(
    ...WEEKLY_SALES_FA.map((d) => d.retailToman + d.wholesaleToman)
  );

  const handleQuickStock = (productId: string, sku: string, delta: number) => {
    const ok = adjustStock(productId, delta, 'ویرایش سریع پنل انبار');
    if (ok) {
      setLastStockUndo({ productId, sku, inverseDelta: -delta });
    }
  };

  const handleExportCsv = () => {
    const header = 'SKU,Name,Category,RetailPrice,Stock,PackUnits\n';
    const rows = products
      .map(
        (p) =>
          `"${p.sku}","${p.name.replace(/"/g, '""')}","${p.categoryName}",${p.price},${p.stock},${p.packDefinition.unitsPerPack}`
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kiya-catalog-export.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('فایل خروجی CSV کاتالوگ (بدون نشت اطلاعات حساس) دانلود شد', 'info');
  };

  const selectedSupportThread =
    directThreads.find((t) => t.id === supportThreadId) || directThreads[0];

  const socialPreviewProduct = products.find((p) => p.id === socialProductId) || products[0];

  return (
    <div className="min-h-screen bg-canvas flex flex-col lg:flex-row" dir="rtl">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-[268px] bg-surface border-l border-border flex flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="h-16 px-4 border-b border-border flex items-center justify-between">
          <Logo isDark={isDark} variant="combo" size="sm" />
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center text-ink-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Role Badge */}
        <div className="px-4 py-2.5 bg-brand-50/70 border-b border-border text-[11px]">
          <span className="text-ink-500 block">حالت تمرکز نقش فعال:</span>
          <span className="font-extrabold text-brand-600">
            {ROLE_DEFINITIONS.find((r) => r.key === activeAdminRole)?.nameFa}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = resolvedTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
                  active
                    ? 'bg-buy text-buy-fg shadow-e1'
                    : 'text-ink-600 hover:bg-canvas-sunken hover:text-ink-900'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-[10px] font-extrabold',
                      active ? 'bg-white/20 text-current' : 'bg-canvas-sunken text-ink-700'
                    )}
                  >
                    {formatNumber(item.badge)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={() => setViewMode('storefront')}
            className="w-full py-2.5 px-3 rounded-xl bg-canvas-sunken hover:bg-brand-50 text-ink-800 font-extrabold text-xs flex items-center justify-center gap-2"
          >
            <Store className="w-4 h-4 text-brand-500" />
            <span>بازگشت به ویترین فروشگاه</span>
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header with Role Impersonation Switcher */}
        <header className="sticky top-0 z-30 glass border-b border-border px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl bg-canvas-sunken flex items-center justify-center"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-extrabold text-sm md:text-base text-ink-900">
                مرکز فرماندهی کیا — KIYA Admin
              </h1>
              <p className="text-[11px] text-ink-500">
                تغییر نقش در نوار مقابل، ماژول‌ها و مجوزهای عملیاتی را بلافاصله محدود می‌کند
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Impersonate-View Role Switcher */}
            <div className="flex items-center gap-1.5 bg-canvas-sunken border border-border rounded-xl px-2.5 py-1.5 text-xs">
              <Shield className="w-4 h-4 text-brand-500 shrink-0" />
              <span className="text-ink-500 hidden sm:inline">مشاهده به‌عنوان نقش:</span>
              <select
                value={activeAdminRole}
                onChange={(e) => setActiveAdminRole(e.target.value as AdminRoleKey)}
                className="bg-transparent font-extrabold text-ink-900 outline-none"
              >
                {ROLE_DEFINITIONS.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.nameFa}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onThemeToggle}
              className="w-9 h-9 rounded-xl bg-canvas-sunken flex items-center justify-center text-ink-700"
              title="تغییر تم"
            >
              {isDark ? <Sun className="w-4 h-4 text-gold-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setViewMode('storefront')}
              className="px-3 py-2 rounded-xl bg-buy text-buy-fg text-xs font-extrabold flex items-center gap-1.5"
            >
              <Store className="w-4 h-4" />
              <span>مشاهده فروشگاه</span>
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="p-4 lg:p-6 max-w-[1380px] w-full mx-auto space-y-5">
          {/* 1. DASHBOARD */}
          {resolvedTab === 'dashboard' && (
            <div className="space-y-5">
              {/* Live Actionable Banners */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-warning-light border border-warning/30 flex items-center justify-between">
                  <span className="font-bold text-ink-900">
                    {formatNumber(lowStockItems.length)} کالا به آستانه کم‌موجودی رسیده‌اند
                  </span>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="font-extrabold text-warning underline"
                  >
                    مدیریت انبار
                  </button>
                </div>
                <div className="p-3.5 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-between">
                  <span className="font-bold text-ink-900">
                    {formatNumber(pendingPartners.length)} پرونده همکاری عمده منتظر بررسی
                  </span>
                  <button
                    onClick={() => setActiveTab('partners')}
                    className="font-extrabold text-brand-600 underline"
                  >
                    صف همکاران
                  </button>
                </div>
                <div className="p-3.5 rounded-2xl bg-info-light border border-info/30 flex items-center justify-between">
                  <span className="font-bold text-ink-900">
                    وضعیت سرویس‌های بیرونی: حالت آزمایشی امن (Demo)
                  </span>
                  <button
                    onClick={() => setActiveTab('integrations')}
                    className="font-extrabold text-info underline"
                  >
                    بررسی اتصال‌ها
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-surface rounded-2xl border border-border p-4 shadow-e1">
                  <span className="text-xs text-ink-500">جمع فروش ثبت‌شده (تکی + عمده)</span>
                  <p className="text-lg md:text-xl font-black text-ink-900 mt-1">
                    {formatPrice(totalConfirmedSales)}
                  </p>
                  <span className="text-[10px] text-ink-400">بر اساس اسنپ‌شات سفارش‌های فعال</span>
                </div>
                <div className="bg-surface rounded-2xl border border-border p-4 shadow-e1">
                  <span className="text-xs text-ink-500">تعداد کل سفارش‌ها</span>
                  <p className="text-lg md:text-xl font-black text-ink-900 mt-1">
                    {formatNumber(orders.length)} سفارش
                  </p>
                  <span className="text-[10px] text-brand-500 font-bold">
                    شامل {formatNumber(orders.filter((o) => o.salesMode === 'WHOLESALE').length)} فاکتور عمده جینی
                  </span>
                </div>
                <div className="bg-surface rounded-2xl border border-border p-4 shadow-e1">
                  <span className="text-xs text-ink-500">همکاران عمده تأییدشده</span>
                  <p className="text-lg md:text-xl font-black text-success mt-1">
                    {formatNumber(approvedPartnersCount)} همکار فعال
                  </p>
                  <span className="text-[10px] text-ink-400">حداقل خرید: ۱ جین کامل</span>
                </div>
                <div className="bg-surface rounded-2xl border border-border p-4 shadow-e1">
                  <span className="text-xs text-ink-500">تنوع کالای کاتالوگ (دمو)</span>
                  <p className="text-lg md:text-xl font-black text-ink-900 mt-1">
                    {formatNumber(products.length)} کد SKU
                  </p>
                  <span className="text-[10px] text-ink-400">مجموع موجودی: {formatNumber(products.reduce((s, p) => s + p.stock, 0))} واحد</span>
                </div>
              </div>

              {/* Weekly Chart + Recent Audit */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-sm text-ink-900">
                      روند فروش هفتگی (شنبه تا جمعه — تفکیک تکی و عمده جینی)
                    </h2>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#482780]" />
                        عمده جینی
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#D19A43]" />
                        تک‌فروشی
                      </span>
                    </div>
                  </div>

                  <div className="h-52 flex items-end gap-3 pt-4">
                    {WEEKLY_SALES_FA.map((d) => {
                      const total = d.retailToman + d.wholesaleToman;
                      const heightPct = Math.round((total / maxChartTotal) * 100);
                      const wholesaleShare = Math.round((d.wholesaleToman / total) * 100);
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <span className="text-[10px] text-ink-500 font-bold">
                            {formatNumber(d.orders)}
                          </span>
                          <div
                            style={{ height: `${Math.max(18, heightPct)}%` }}
                            className="w-full max-w-[42px] rounded-t-xl overflow-hidden flex flex-col bg-[#D19A43]"
                            title={`${d.day}: ${formatPrice(total)}`}
                          >
                            <div
                              style={{ height: `${wholesaleShare}%` }}
                              className="w-full bg-[#482780]"
                            />
                          </div>
                          <span className="text-[11px] font-bold text-ink-700">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-3">
                  <h2 className="font-extrabold text-sm text-ink-900">آخرین رویدادهای Audit Log</h2>
                  <div className="space-y-2.5 max-h-[230px] overflow-y-auto">
                    {auditLogs.slice(0, 6).map((log) => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-canvas-sunken text-xs space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-ink-900">{log.actorName}</span>
                          <span className="font-mono text-[10px] text-brand-600">
                            <bdi>{log.action}</bdi>
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-600 leading-relaxed">{log.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. PRODUCTS & PACK BOM */}
          {resolvedTab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-base text-ink-900">
                    کاتالوگ کالاها و پیکربندی جین عمده (PackDefinition)
                  </h2>
                  <p className="text-xs text-ink-500">
                    تغییر قیمت بیش از ۱۵٪ توسط نقش‌های غیراز مالک، نیازمند تأیید دو مرحله‌ای مالک است.
                  </p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold flex items-center gap-1.5 hover:bg-canvas-sunken"
                >
                  <Download className="w-4 h-4" />
                  <span>خروجی CSV کاتالوگ</span>
                </button>
              </div>

              <div className="bg-surface rounded-2xl border border-border shadow-e1 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-canvas-sunken text-ink-600">
                    <tr>
                      <th className="text-right px-4 py-3 font-extrabold">کالا و SKU</th>
                      <th className="text-right px-4 py-3 font-extrabold">دسته</th>
                      <th className="text-right px-4 py-3 font-extrabold">قیمت تکی</th>
                      <th className="text-right px-4 py-3 font-extrabold">ساختار جین و واحد عمده</th>
                      <th className="text-right px-4 py-3 font-extrabold">موجودی مشترک</th>
                      <th className="text-right px-4 py-3 font-extrabold">ویرایش</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {products.map((prod) => {
                      const pack = prod.packDefinition;
                      const availPacks = Math.floor(prod.stock / pack.unitsPerPack);
                      return (
                        <tr key={prod.id} className="hover:bg-canvas-sunken/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={prod.images[0]}
                                alt=""
                                className="w-11 h-11 rounded-xl object-cover shrink-0"
                              />
                              <div>
                                <p className="font-bold text-ink-900">{prod.name}</p>
                                <span className="font-mono text-[10px] text-ink-400">
                                  <bdi>{prod.sku}</bdi>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-ink-700">{prod.categoryName}</td>
                          <td className="px-4 py-3 font-extrabold text-ink-900">
                            {formatPrice(prod.price)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-brand-600">
                              {pack.label} ({formatNumber(pack.unitsPerPack)} تایی)
                            </p>
                            <p className="text-[11px] text-ink-500">
                              {pack.priceMode === 'FIXED'
                                ? `واحد عمده: ${formatPrice(pack.wholesaleUnitPriceToman)}`
                                : 'حالت قیمت: استعلامی (INQUIRY)'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-ink-900">
                              {formatNumber(prod.stock)} واحد
                            </span>
                            <span className="block text-[10px] text-ink-500">
                              معادل {formatNumber(availPacks)} جین کامل
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setEditingProduct(prod)}
                              className="px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 font-bold inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              ویرایش
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. INVENTORY & STOCK LEDGER */}
          {resolvedTab === 'inventory' && (
            <div className="space-y-4">
              {lastStockUndo && (
                <div className="p-3.5 rounded-2xl bg-brand-50 border border-brand-300 flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-900">
                    آخرین تغییر موجودی روی <bdi>{lastStockUndo.sku}</bdi> ثبت شد. مایل به بازگردانی هستید؟
                  </span>
                  <button
                    onClick={() => {
                      adjustStock(
                        lastStockUndo.productId,
                        lastStockUndo.inverseDelta,
                        'بازگردانی سریع (Undo) تغییر انبار'
                      );
                      setLastStockUndo(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-buy text-buy-fg font-extrabold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    بازگردانی (Undo)
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-7 bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border font-extrabold text-sm text-ink-900">
                    تنظیم سریع موجودی فیزیکی (مشترک بین تکی و عمده)
                  </div>
                  <div className="divide-y divide-border">
                    {products.map((prod) => (
                      <div
                        key={prod.id}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-ink-900">{prod.name}</p>
                          <p className="text-[11px] text-ink-500">
                            <bdi>{prod.sku}</bdi> · موجودی فعلی:{' '}
                            <strong
                              className={cn(
                                prod.stock <= prod.lowStockThreshold ? 'text-danger' : 'text-success'
                              )}
                            >
                              {formatNumber(prod.stock)} واحد
                            </strong>{' '}
                            ({formatNumber(Math.floor(prod.stock / prod.packDefinition.unitsPerPack))} جین)
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          {[-5, -1, +1, +5, +10].map((d) => (
                            <button
                              key={d}
                              onClick={() => handleQuickStock(prod.id, prod.sku, d)}
                              className={cn(
                                'px-2.5 py-1.5 rounded-lg font-extrabold border text-[11px]',
                                d > 0
                                  ? 'bg-success-light/60 border-success/30 text-success hover:bg-success-light'
                                  : 'bg-danger-light/60 border-danger/30 text-danger hover:bg-danger-light'
                              )}
                            >
                              <bdi>{d > 0 ? `+${d}` : d}</bdi>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stock Ledger */}
                <div className="lg:col-span-5 bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border font-extrabold text-sm text-ink-900">
                    دفتر کاردکس انبار (Stock Ledger)
                  </div>
                  <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                    {stockLedger.map((sl) => (
                      <div key={sl.id} className="p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink-900">{sl.productName}</span>
                          <span
                            className={cn(
                              'font-mono font-black px-2 py-0.5 rounded',
                              sl.delta >= 0
                                ? 'bg-success-light text-success'
                                : 'bg-danger-light text-danger'
                            )}
                          >
                            <bdi>{sl.delta > 0 ? `+${sl.delta}` : sl.delta}</bdi>
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-600">{sl.reason}</p>
                        <p className="text-[10px] text-ink-400">
                          مانده پس از عمل: {formatNumber(sl.balanceAfter)} · توسط {sl.actor}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. ORDERS */}
          {resolvedTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-extrabold text-base text-ink-900">
                  مدیریت سفارش‌ها (همگام با تایم‌لاین مشتری)
                </h2>
                <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 text-xs font-bold">
                  {(['ALL', 'RETAIL', 'WHOLESALE'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setOrderModeFilter(m)}
                      className={cn(
                        'px-3 py-1 rounded-lg',
                        orderModeFilter === m ? 'bg-buy text-buy-fg' : 'text-ink-600'
                      )}
                    >
                      {m === 'ALL' ? 'همه سفارش‌ها' : m === 'WHOLESALE' ? 'عمده جینی' : 'تک‌فروشی'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-2xl border border-border shadow-e1 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-canvas-sunken text-ink-600">
                    <tr>
                      <th className="text-right px-4 py-3 font-extrabold">کد سفارش</th>
                      <th className="text-right px-4 py-3 font-extrabold">نوع</th>
                      <th className="text-right px-4 py-3 font-extrabold">خریدار / شهر</th>
                      <th className="text-right px-4 py-3 font-extrabold">مبلغ کل</th>
                      <th className="text-right px-4 py-3 font-extrabold">وضعیت فعلی</th>
                      <th className="text-right px-4 py-3 font-extrabold">تغییر وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders
                      .filter((o) => orderModeFilter === 'ALL' || o.salesMode === orderModeFilter)
                      .map((ord) => {
                        const meta = ORDER_STATUS_META[ord.status];
                        return (
                          <tr key={ord.id} className="hover:bg-canvas-sunken/50">
                            <td className="px-4 py-3 font-mono font-black text-brand-600">
                              <bdi>{ord.code}</bdi>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-extrabold',
                                  ord.salesMode === 'WHOLESALE'
                                    ? 'bg-gold-400/25 text-gold-text'
                                    : 'bg-canvas-sunken text-ink-700'
                                )}
                              >
                                {ord.salesMode === 'WHOLESALE' ? 'عمده جینی' : 'تکی'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-ink-900">{ord.customerName}</p>
                              <p className="text-[10px] text-ink-500">{ord.city}</p>
                            </td>
                            <td className="px-4 py-3 font-extrabold text-ink-900">
                              {formatPrice(ord.totalToman)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-[10px] font-extrabold',
                                  meta.badgeClass
                                )}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={ord.status}
                                onChange={(e) =>
                                  updateOrderStatus(ord.id, e.target.value as OrderStatus)
                                }
                                className="h-8 px-2 rounded-lg bg-canvas-sunken border border-border text-xs font-bold outline-none"
                              >
                                <option value="pending">در انتظار</option>
                                <option value="confirmed">تأیید پرداخت</option>
                                <option value="preparing">در حال آماده‌سازی</option>
                                <option value="shipped">تحویل به پست/پیک</option>
                                <option value="delivered">تحویل‌شده</option>
                                <option value="cancelled">لغو</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. PARTNERS & WHOLESALE POLICY */}
          {resolvedTab === 'partners' && (
            <div className="space-y-4">
              <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <h2 className="font-extrabold text-sm text-brand-600 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    سیاست فعال عمده‌فروشی کیا (نسخه ۱ — مصوب مالک)
                  </h2>
                  <p className="text-ink-700 mt-1">
                    حداقل ردیف: <strong>۱ جین</strong> · حداقل کل سفارش: <strong>۱ جین</strong> · گام افزایش: <strong>۱ جین</strong> · حداقل مبلغ اضافی: <strong>ندارد (۰ تومان)</strong> · انبار SKU مشترک.
                  </p>
                </div>
                <input
                  type="text"
                  value={partnerReason}
                  onChange={(e) => setPartnerReason(e.target.value)}
                  placeholder="علت یا یادداشت تأیید/رد/تعلیق برای ثبت در Audit..."
                  className="w-full sm:w-72 h-9 px-3 rounded-xl bg-surface border border-border text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {partnerApplications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-surface rounded-2xl border border-border p-4 shadow-e1 space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-sm text-ink-900">{app.businessName}</h3>
                        <p className="text-ink-500">
                          متقاضی: {app.applicantName} · شهر: {app.city} · موبایل:{' '}
                          <bdi>{app.phone}</bdi>
                        </p>
                      </div>
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-extrabold',
                          app.status === 'APPROVED' && 'bg-success-light text-success',
                          app.status === 'PENDING' && 'bg-warning-light text-warning',
                          app.status === 'SUSPENDED' && 'bg-danger-light text-danger',
                          app.status === 'REJECTED' && 'bg-canvas-sunken text-ink-600'
                        )}
                      >
                        {app.status}
                      </span>
                    </div>

                    <p className="text-ink-700 bg-canvas-sunken p-2.5 rounded-xl leading-relaxed">
                      {app.note}
                    </p>

                    {app.reviewedBy && (
                      <p className="text-[11px] text-ink-500">
                        آخرین بررسی: {app.reviewedBy} — {app.reviewReason}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => reviewPartnerApp(app.id, 'APPROVED', partnerReason)}
                        className="px-3 py-1.5 rounded-xl bg-success text-white font-bold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تأیید همکاری
                      </button>
                      <button
                        onClick={() => reviewPartnerApp(app.id, 'REJECTED', partnerReason)}
                        className="px-3 py-1.5 rounded-xl bg-canvas-sunken text-ink-800 border border-border font-bold flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        رد درخواست
                      </button>
                      <button
                        onClick={() => reviewPartnerApp(app.id, 'SUSPENDED', partnerReason)}
                        className="px-3 py-1.5 rounded-xl bg-danger-light text-danger font-bold flex items-center gap-1"
                      >
                        <PauseCircle className="w-3.5 h-3.5" />
                        تعلیق فوری
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. SOCIALHUB & CMS */}
          {resolvedTab === 'social' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Feed & Channel Publisher */}
              <div className="bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-3.5 text-xs">
                <h2 className="font-extrabold text-sm text-ink-900">
                  انتشار پست هم‌زمان از کاتالوگ (SocialHub)
                </h2>
                <p className="text-ink-500">
                  خروجی عمومی کانال تلگرام (<bdi>@kiyaco24</bdi>) و بسته اینستاگرام صرفاً قیمت تک‌فروشی را درج می‌کند و هرگز قیمت عمده را منتشر نمی‌سازد.
                </p>

                <div>
                  <label className="font-bold text-ink-700 block mb-1">انتخاب کالا</label>
                  <select
                    value={socialProductId}
                    onChange={(e) => setSocialProductId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-ink-700 block mb-1">برچسب بالای پست</label>
                  <input
                    type="text"
                    value={socialBadge}
                    onChange={(e) => setSocialBadge(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-canvas-sunken border border-border outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-ink-700 block mb-1">متن کپشن فید و شبکه‌ها</label>
                  <textarea
                    rows={3}
                    value={socialCaption}
                    onChange={(e) => setSocialCaption(e.target.value)}
                    className="w-full p-3 rounded-xl bg-canvas-sunken border border-border outline-none"
                  />
                </div>

                {socialPreviewProduct && (
                  <div className="p-3 rounded-xl bg-canvas-sunken border border-border space-y-1 font-mono text-[11px]">
                    <p className="font-sans font-bold text-brand-600">
                      پیش‌نمایش بسته آماده انتشار در @kiyaco24:
                    </p>
                    <p className="font-sans">{socialPreviewProduct.name}</p>
                    <p className="font-sans">{socialCaption}</p>
                    <p className="font-sans font-bold">
                      قیمت تک‌فروشی: {formatPrice(socialPreviewProduct.price)} | خرید عمده همکاران: پیام به پشتیبانی
                    </p>
                  </div>
                )}

                <button
                  onClick={() =>
                    createSocialPostFromProduct(socialProductId, socialCaption, socialBadge)
                  }
                  className="w-full py-2.5 rounded-xl bg-buy text-buy-fg font-extrabold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>انتشار فوری در فید فروشگاه</span>
                </button>
              </div>

              {/* Storefront CMS & Emergency Order Pause */}
              <div className="bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-4 text-xs">
                <h2 className="font-extrabold text-sm text-ink-900">
                  تنظیمات نوار اطلاع‌رسانی و کلید توقف سفارش‌گیری (CMS)
                </h2>

                <div>
                  <label className="font-bold text-ink-700 block mb-1">
                    متن نوار بنفش بالای فروشگاه
                  </label>
                  <input
                    type="text"
                    value={announcementBanner}
                    onChange={(e) => setAnnouncementBanner(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-canvas-sunken border border-border flex items-center justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-ink-900">توقف موقت ثبت سفارش (Order Pause)</p>
                    <p className="text-[11px] text-ink-500 mt-0.5">
                      در زمان انبارگردانی، ویترین باز می‌ماند اما افزودن به سبد و ثبت سفارش متوقف می‌شود.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setOrdersPaused(!ordersPaused);
                      showToast(
                        !ordersPaused
                          ? 'ثبت سفارش موقتاً متوقف شد'
                          : 'سفارش‌گیری مجدداً فعال شد',
                        'info'
                      );
                    }}
                    className={cn(
                      'px-4 py-2 rounded-xl font-extrabold shrink-0',
                      ordersPaused ? 'bg-danger text-white' : 'bg-success text-white'
                    )}
                  >
                    {ordersPaused ? 'سفارش‌گیری متوقف است' : 'سفارش‌گیری فعال است'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 7. SUPPORT INBOX (WITH CONFIDENTIAL INTERNAL NOTES) */}
          {resolvedTab === 'support' && (
            <div className="bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[480px] text-xs">
              <div className="md:col-span-4 border-l border-border divide-y divide-border">
                {directThreads.map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setSupportThreadId(th.id)}
                    className={cn(
                      'w-full p-3.5 text-right space-y-1',
                      th.id === selectedSupportThread?.id
                        ? 'bg-brand-50'
                        : 'hover:bg-canvas-sunken'
                    )}
                  >
                    <p className="font-extrabold text-ink-900">{th.title}</p>
                    <p className="text-[11px] text-ink-500">
                      مشتری: {th.customerName} · {th.tag}
                    </p>
                  </button>
                ))}
              </div>

              <div className="md:col-span-8 flex flex-col">
                {selectedSupportThread && (
                  <>
                    <div className="p-3.5 border-b border-border flex items-center justify-between bg-canvas-sunken/50">
                      <span className="font-extrabold text-ink-900">
                        پرونده گفتگو: {selectedSupportThread.customerName}
                      </span>
                      <span className="text-[11px] text-ink-500">
                        یادداشت‌های زرد صرفاً برای کارکنان قابل مشاهده‌اند
                      </span>
                    </div>

                    <div className="flex-1 p-4 space-y-2.5 overflow-y-auto max-h-[340px]">
                      {selectedSupportThread.messages.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            'p-3 rounded-2xl space-y-1',
                            m.isInternalNote
                              ? 'bg-warning-light border border-warning/40 text-ink-900'
                              : m.sender === 'customer'
                                ? 'bg-canvas-sunken text-ink-900'
                                : 'bg-brand-50 text-ink-900'
                          )}
                        >
                          <div className="flex items-center justify-between text-[10px] font-extrabold">
                            <span className="flex items-center gap-1">
                              {m.isInternalNote && <Lock className="w-3 h-3 text-warning" />}
                              {m.senderName}
                            </span>
                            <span className="text-ink-400">
                              {formatJalaliDateTime(m.createdAt)}
                            </span>
                          </div>
                          <p className="leading-relaxed">{m.text}</p>
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!supportReply.trim()) return;
                        sendDirectMessage(selectedSupportThread.id, supportReply, 'support', {
                          isInternalNote,
                        });
                        setSupportReply('');
                      }}
                      className="p-3 border-t border-border flex flex-wrap items-center gap-2"
                    >
                      <label className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-warning-light text-ink-900 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                        />
                        یادداشت داخلی محرمانه
                      </label>
                      <input
                        type="text"
                        value={supportReply}
                        onChange={(e) => setSupportReply(e.target.value)}
                        placeholder={
                          isInternalNote
                            ? 'یادداشت محرمانه برای همکاران پشتیبانی (مخفی از مشتری)...'
                            : 'پاسخ رسمی فروشگاه کیا به مشتری...'
                        }
                        className="flex-1 min-w-[200px] h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 h-10 rounded-xl bg-buy text-buy-fg font-extrabold flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5 -scale-x-100" />
                        ثبت
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 8. FINANCE & WALLET RECONCILIATION */}
          {resolvedTab === 'finance' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-canvas-sunken border border-border text-xs text-ink-700">
                <strong>شفافیت مالی (مطابق قرارداد فنی کیا):</strong> تا پیش از ثبت کامل هزینه‌های عمومی، بسته‌بندی و کارمزد تسویه درگاه، شاخص‌ها با عنوان دقیق «فروش ناخالص تأییدشده» نمایش داده می‌شوند و از درج «سود خالص ساختگی» پرهیز شده است.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface rounded-2xl border border-border p-4">
                  <span className="text-xs text-ink-500">فروش تک‌فروشی ثبت‌شده</span>
                  <p className="text-xl font-black text-ink-900 mt-1">
                    {formatPrice(
                      orders
                        .filter((o) => o.salesMode === 'RETAIL' && o.status !== 'cancelled')
                        .reduce((s, o) => s + o.totalToman, 0)
                    )}
                  </p>
                </div>
                <div className="bg-surface rounded-2xl border border-border p-4">
                  <span className="text-xs text-ink-500">فروش عمده جینی همکاران</span>
                  <p className="text-xl font-black text-brand-600 mt-1">
                    {formatPrice(
                      orders
                        .filter((o) => o.salesMode === 'WHOLESALE' && o.status !== 'cancelled')
                        .reduce((s, o) => s + o.totalToman, 0)
                    )}
                  </p>
                </div>
                <div className="bg-surface rounded-2xl border border-border p-4">
                  <span className="text-xs text-ink-500">تعداد ردیف‌های دفتر کل کیف پول</span>
                  <p className="text-xl font-black text-ink-900 mt-1">
                    {formatNumber(walletEntries.length)} سند
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 9. RBAC MATRIX & AUDIT LOG */}
          {resolvedTab === 'rbac' && (
            <div className="space-y-5">
              <div className="bg-surface rounded-2xl border border-border p-5 shadow-e1 space-y-3">
                <h2 className="font-extrabold text-sm text-ink-900">
                  ماتریس نقش‌ها، محدوده داده (Scope) و مجوزهای RBAC
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {ROLE_DEFINITIONS.map((r) => (
                    <div
                      key={r.key}
                      className={cn(
                        'p-3.5 rounded-2xl border space-y-2',
                        activeAdminRole === r.key
                          ? 'border-brand-500 bg-brand-50/50'
                          : 'border-border bg-canvas-sunken/50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-ink-900">{r.nameFa}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-border font-bold">
                          {r.scopeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-600">{r.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {r.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-ink-700"
                          >
                            <bdi>{perm}</bdi>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-2xl border border-border shadow-e1 overflow-hidden">
                <div className="px-4 py-3 border-b border-border font-extrabold text-sm text-ink-900">
                  لاگ تغییرناپذیر ممیزی (Audit Log)
                </div>
                <div className="divide-y divide-border text-xs">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-extrabold',
                              log.severity === 'critical'
                                ? 'bg-danger-light text-danger'
                                : log.severity === 'warning'
                                  ? 'bg-warning-light text-warning'
                                  : 'bg-info-light text-info'
                            )}
                          >
                            <bdi>{log.action}</bdi>
                          </span>
                          <span className="font-extrabold text-ink-900">{log.actorName}</span>
                          <span className="text-ink-500">← {log.target}</span>
                        </div>
                        <p className="text-ink-600">{log.detail}</p>
                      </div>
                      <span className="text-[11px] text-ink-400">
                        {formatJalaliDateTime(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 10. INTEGRATIONS HEALTH (HONEST BLOCKED/UNCONFIGURED STATUS PER DOC 17) */}
          {resolvedTab === 'integrations' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-warning-light border border-warning/35 text-xs text-ink-900 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">
                    وضعیت واقعی سرویس‌های خارجی (بدون نمایش وضعیت متصل جعلی — مطابق سند ۱۷):
                  </p>
                  <p className="mt-1 text-ink-700 leading-relaxed">
                    هیچ کلید خصوصی یا توکن افشاشده‌ای در کد یا مخزن ذخیره نشده است. برای فعال‌سازی نهایی محیط تولید، متغیرهای محیطی زیر باید در سرور میزبان مقداردهی شوند.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {INTEGRATION_RECORDS.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-surface rounded-2xl border border-border p-4 shadow-e1 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-sm text-ink-900">{rec.title}</h3>
                        <p className="font-mono text-[11px] text-brand-500">
                          <bdi>{rec.publicHandle}</bdi>
                        </p>
                      </div>
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold',
                          rec.status === 'REQUIRES_NEW_SECRET'
                            ? 'bg-danger-light text-danger'
                            : 'bg-warning-light text-warning'
                        )}
                      >
                        <bdi>{rec.status}</bdi>
                      </span>
                    </div>
                    <p className="text-ink-600 leading-relaxed">{rec.note}</p>
                    <div className="p-2 rounded-lg bg-canvas-sunken font-mono text-[10px] text-ink-600 flex items-center justify-between">
                      <span>ENV:</span>
                      <bdi>{rec.envVarName}</bdi>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Product & Pack BOM Edit Modal */}
      {editingProduct && (
        <div
          onClick={(e) => e.target === e.currentTarget && setEditingProduct(null)}
          className="fixed inset-0 z-[130] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (saveProductChanges(editingProduct)) {
                setEditingProduct(null);
              }
            }}
            className="bg-surface w-full max-w-[560px] rounded-3xl border border-border p-5 shadow-e4 space-y-3.5 text-xs"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <h3 className="font-extrabold text-base text-ink-900">
                ویرایش کالا و جین عمده (<bdi>{editingProduct.sku}</bdi>)
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-xl bg-canvas-sunken flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="font-bold text-ink-700 block mb-1">نام محصول</label>
              <input
                type="text"
                value={editingProduct.name}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
                className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-ink-700 block mb-1">
                  قیمت تک‌فروشی (تومان)
                </label>
                <input
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      price: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border font-mono outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-ink-700 block mb-1">
                  تعداد واحد در هر جین (BOM)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editingProduct.packDefinition.unitsPerPack}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      packDefinition: {
                        ...editingProduct.packDefinition,
                        unitsPerPack: Math.max(1, Math.round(Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border font-mono outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-ink-700 block mb-1">حالت قیمت عمده</label>
                <select
                  value={editingProduct.packDefinition.priceMode}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      packDefinition: {
                        ...editingProduct.packDefinition,
                        priceMode: e.target.value as 'FIXED' | 'INQUIRY',
                      },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border outline-none"
                >
                  <option value="FIXED">قیمت مشخص همکار (FIXED)</option>
                  <option value="INQUIRY">استعلامی پشتیبانی (INQUIRY)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-ink-700 block mb-1">
                  قیمت واحد عمده همکار (تومان)
                </label>
                <input
                  type="number"
                  disabled={editingProduct.packDefinition.priceMode === 'INQUIRY'}
                  value={editingProduct.packDefinition.wholesaleUnitPriceToman}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      packDefinition: {
                        ...editingProduct.packDefinition,
                        wholesaleUnitPriceToman: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-canvas-sunken border border-border font-mono outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2.5 rounded-xl bg-canvas-sunken text-ink-700 font-bold"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-buy text-buy-fg font-extrabold"
              >
                ذخیره تغییرات و ثبت در Audit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
