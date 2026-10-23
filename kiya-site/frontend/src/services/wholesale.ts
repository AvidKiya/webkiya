// Private DTOs stay in component memory, never in the public Product model or storage.
export type PartnerApplicationDTO = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  businessName: string;
  city: string;
  note: string;
  reason: string | null;
  expiresAt: string | null;
  version: number;
};
export type CustomerIdentity = {
  id: string;
  name: string;
  kind: string;
  isDemo: boolean;
};
export type WholesaleOffer = {
  product: {
    id: string;
    name: string;
    image: string;
    retailPriceToman: string;
    isDemo: boolean;
  };
  pack: {
    id: string;
    label: string;
    mode: string;
    version: number;
    unitsPerPack: number;
    components: { name: string; hex: string; units: number }[];
  };
  offerId: string;
  offerVersion: number;
  validUntil: string | null;
  available: boolean;
} & (
  | { pricing: "PRICED"; unitPriceToman: string; packPriceToman: string }
  | { pricing: "INQUIRY" }
);
export type WholesaleCatalog = {
  items: WholesaleOffer[];
  accessExpiresAt: string | null;
  minPacks: 1;
  minAmountToman: "0";
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
const money = (v: unknown): v is string =>
  typeof v === "string" && /^\d{1,18}$/.test(v);
const date = (v: unknown) =>
  v === null || (typeof v === "string" && Number.isFinite(Date.parse(v)));
const localImage = (v: unknown) =>
  typeof v === "string" && /^\/(?!\/)/.test(v) && !/[\\\x00-\x20]/.test(v);
export function parseWholesaleCatalog(value: unknown): WholesaleCatalog {
  const fail = () => {
    throw new Error(
      "پاسخ قیمت اختصاصی معتبر نیست؛ هیچ نرخ جایگزینی نمایش داده نشد.",
    );
  };
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 100 ||
    !date(value.accessExpiresAt) ||
    value.minPacks !== 1 ||
    value.minAmountToman !== "0"
  )
    return fail();
  const ids = new Set<string>();
  for (const item of value.items) {
    if (!record(item) || !record(item.product) || !record(item.pack))
      return fail();
    const p = item.product,
      k = item.pack;
    if (
      typeof item.offerId !== "string" ||
      !item.offerId ||
      ids.has(item.offerId) ||
      !integer(item.offerVersion) ||
      typeof item.available !== "boolean" ||
      !date(item.validUntil) ||
      typeof p.id !== "string" ||
      typeof p.name !== "string" ||
      !localImage(p.image) ||
      !money(p.retailPriceToman) ||
      typeof p.isDemo !== "boolean" ||
      typeof k.id !== "string" ||
      !k.id ||
      typeof k.label !== "string" ||
      !["HOMOGENEOUS", "FIXED_ASSORTMENT"].includes(String(k.mode)) ||
      !integer(k.version) ||
      !integer(k.unitsPerPack) ||
      !Array.isArray(k.components) ||
      !k.components.length ||
      k.components.length > 100
    )
      return fail();
    let units = 0;
    for (const c of k.components) {
      if (
        !record(c) ||
        typeof c.name !== "string" ||
        typeof c.hex !== "string" ||
        !integer(c.units)
      )
        return fail();
      units += Number(c.units);
    }
    if (!Number.isSafeInteger(units) || units !== k.unitsPerPack) return fail();
    if (item.pricing === "PRICED") {
      if (
        !money(item.unitPriceToman) ||
        !money(item.packPriceToman) ||
        BigInt(item.unitPriceToman) <= 0n ||
        BigInt(item.packPriceToman) !==
          BigInt(item.unitPriceToman) * BigInt(Number(k.unitsPerPack))
      )
        return fail();
    } else if (
      item.pricing !== "INQUIRY" ||
      "unitPriceToman" in item ||
      "packPriceToman" in item
    )
      return fail();
    ids.add(item.offerId);
  }
  return value as unknown as WholesaleCatalog;
}
export function accessExpired(
  application: { expiresAt: string | null } | null,
  now = Date.now(),
) {
  return !!application?.expiresAt && Date.parse(application.expiresAt) <= now;
}
export function offerExpired(offer: WholesaleOffer, now = Date.now()) {
  return !!offer.validUntil && Date.parse(offer.validUntil) <= now;
}
export function formatToman(value: string) {
  if (!money(value)) throw new Error("مبلغ معتبر نیست.");
  return new Intl.NumberFormat("fa-IR").format(BigInt(value)) + " تومان";
}
