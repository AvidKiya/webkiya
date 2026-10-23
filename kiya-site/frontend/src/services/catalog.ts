import type { Product, Post, CategorySlug } from "../types";
export type CatalogItem = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  image: string;
  price: string;
  previous?: string;
  isDemo?: boolean;
  availableUnits: number;
  colors: { id?: string; name: string; available?: boolean }[];
};
const categoryMap: Record<string, CategorySlug> = {
  "کیف و کیف پول": "bags",
  "لباس زیر": "underwear",
  "کفش و کمربند": "shoes",
  "اکسسوری موبایل": "mobile-accessories",
  "دکوری و هدیه": "small-decor-gifts",
  "اکسسوری شخصی": "personal-accessories",
  "ساعت و زیورآلات": "personal-accessories",
};
function money(value: string) {
  if (typeof value !== "string" || !/^\d+(?:\.0+)?$/.test(value))
    throw new Error("مبلغ کاتالوگ معتبر نیست.");
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("مبلغ خارج از محدودهٔ نمایش است.");
  return amount;
}
export function adaptCatalog(items: CatalogItem[]): {
  products: Product[];
  posts: Post[];
} {
  if (!Array.isArray(items) || items.length > 100)
    throw new Error("پاسخ کاتالوگ معتبر نیست.");
  const ids = new Set<string>();
  const products = items.map((item) => {
    if (
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.name !== "string" ||
      typeof item.subtitle !== "string" ||
      typeof item.description !== "string" ||
      typeof item.category !== "string" ||
      !Array.isArray(item.colors) ||
      item.colors.some(
        (c) => typeof c.name !== "string" || typeof c.id !== "string",
      ) ||
      !Number.isSafeInteger(item.availableUnits) ||
      item.availableUnits < 0 ||
      typeof item.image !== "string" ||
      !/^\/(?!\/)/.test(item.image) ||
      /[\\\x00-\x20]/.test(item.image)
    )
      throw new Error("دادهٔ کالا معتبر نیست.");
    ids.add(item.id);
    return {
      id: item.id,
      slug: item.id,
      sku: "",
      name: item.name,
      shortDescription: item.subtitle,
      description: item.description,
      categorySlug: categoryMap[item.category] || "other",
      categoryName: item.category,
      audience: "یونیسکس",
      price: money(item.price),
      ...(item.previous ? { comparePrice: money(item.previous) } : {}),
      images: [item.image],
      colors: item.colors.map((c) => c.name),
      sizes: ["پیش‌فرض"],
      sizeLabel: "مدل",
      stock: item.availableUnits,
      lowStockThreshold: 0,
      soldCount: 0,
      rating: 0,
      reviewCount: 0,
      sizeGuideNote: "اندازه و مشخصات را پیش از خرید از پشتیبانی تأیید کنید.",
      specs: [],
      faqs: [],
      tags: [],
      variantRefs: item.colors
        .filter((c) => c.id)
        .map((c) => ({ id: c.id!, name: c.name })),
      serverManaged: true,
      isDemo: item.isDemo === true,
      packDefinition: {
        id: "",
        label: "تعریف جین از سرویس عمده دریافت می‌شود",
        type: "FIXED_ASSORTMENT",
        unitsPerPack: 1,
        version: 0,
        components: [],
        wholesaleUnitPriceToman: 0,
        priceMode: "INQUIRY",
      },
      createdAt: "",
    } as Product;
  });
  return {
    products,
    posts: products.map((p) => ({
      id: p.id,
      productId: p.id,
      caption: p.description || p.shortDescription,
      likes: 0,
      commentsCount: 0,
      createdAt: "",
      badge: p.isDemo ? "نمونهٔ دیتابیس" : undefined,
    })),
  };
}
export async function fetchCatalog(signal?: AbortSignal) {
  const response = await fetch("/api/catalog", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error(result.error?.message || "دریافت کاتالوگ ناموفق بود.");
  return adaptCatalog(result.data?.items);
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error(result.error?.message || "عملیات سرور ناموفق بود.");
  return result.data;
}

// Broadcast only an invalidation nonce, never session tokens or personal data.
export function announceAuthChange() {
  window.dispatchEvent(new Event("kiya-auth-changed"));
  try {
    localStorage.setItem("kiya-auth-change", crypto.randomUUID());
  } catch {
    /* Storage may be disabled. */
  }
}
