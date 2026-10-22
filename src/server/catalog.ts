import "server-only";
import { db } from "./db";
import type { Product } from "@/lib/catalog";
const select = {
  id: true,
  name: true,
  subtitle: true,
  category: true,
  description: true,
  imagePath: true,
  price: true,
  previousPrice: true,
  packSize: true,
  tag: true,
  collection: true,
  isDemo: true,
  variants: {
    where: { isActive: true },
    orderBy: { createdAt: "asc" as const },
    select: { name: true, hex: true, stock: true, reserved: true },
  },
} as const;
function dto(p: Awaited<ReturnType<typeof rows>>[number]): Product {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.subtitle || p.name,
    category: p.category,
    description: p.description,
    image: p.imagePath,
    price: p.price.toString(),
    ...(p.previousPrice?.gt(p.price)
      ? { previous: p.previousPrice.toString() }
      : {}),
    packSize: p.packSize || 1,
    tag: p.tag,
    collection: p.collection,
    isDemo: p.isDemo,
    colors: p.variants.map((v) => ({
      name: v.name,
      hex: v.hex,
      available: p.isDemo || v.stock > v.reserved,
    })),
  };
}
function visible() {
  return {
    status: "PUBLISHED",
    imagePath: { not: "" },
    category: { not: "" },
    variants: { some: { isActive: true } },
    ...(process.env.APP_MODE !== "demo" ? { isDemo: false } : {}),
  };
}
function rows() {
  return db().product.findMany({
    where: visible(),
    select,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}
export async function publicCatalog() {
  return (await rows()).map(dto);
}
export async function publicProduct(id: string) {
  const p = await db().product.findFirst({
    where: { ...visible(), id },
    select,
  });
  return p ? dto(p) : null;
}
