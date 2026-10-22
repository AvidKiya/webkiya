import fixtures from "./catalog-fixtures.json";
export type Product = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  image: string;
  price: string;
  previous?: string;
  description: string;
  colors: { name: string; hex: string; available?: boolean }[];
  isDemo?: boolean;
  packSize: number;
  tag: string;
  collection: string;
};
export const products: Product[] = fixtures.map((p) => ({
  ...p,
  isDemo: true,
}));
export const categories = [
  "همه",
  "کیف و کیف پول",
  "ساعت و زیورآلات",
  "اکسسوری شخصی",
  "دکوری و هدیه",
  "لباس زیر",
  "کفش و کمربند",
  "اکسسوری موبایل",
];
export const faNumber = (n: number | string) =>
  new Intl.NumberFormat("fa-IR").format(Number(n));
export const money = (price: string) => faNumber(price);
export type CartItem = { productId: string; color: string; qty: number };
export function cartTotal(
  items: CartItem[],
  catalog: Product[] = products,
): string {
  return items
    .reduce((sum, item) => {
      const product = catalog.find((p) => p.id === item.productId);
      return sum + (product ? BigInt(product.price) * BigInt(item.qty) : 0n);
    }, 0n)
    .toString();
}
export function validCart(
  value: unknown,
  catalog: Product[] = products,
): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is CartItem =>
        typeof v === "object" &&
        v !== null &&
        typeof v.productId === "string" &&
        catalog.some((p) => p.id === v.productId) &&
        Number.isInteger(v.qty) &&
        v.qty > 0 &&
        v.qty <= 20 &&
        typeof v.color === "string" &&
        catalog.some(
          (p) =>
            p.id === v.productId && p.colors.some((c) => c.name === v.color),
        ),
    )
    .slice(0, 30)
    .map((v) => ({ productId: v.productId, color: v.color, qty: v.qty }));
}
