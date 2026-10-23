import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseWholesaleCatalog,
  formatToman,
  accessExpired,
  offerExpired,
} from "../src/services/wholesale.ts";
const offer = {
  offerId: "offer",
  offerVersion: 1,
  available: true,
  pricing: "PRICED",
  unitPriceToman: "1234567",
  packPriceToman: "7407402",
  validUntil: null,
  product: {
    id: "product",
    name: "کالای واقعی",
    image: "/api/media/id",
    retailPriceToman: "2500000",
    isDemo: false,
  },
  pack: {
    id: "pack",
    label: "شش تایی واقعی",
    mode: "FIXED_ASSORTMENT",
    version: 1,
    unitsPerPack: 6,
    components: [{ name: "مشکی", hex: "#000000", units: 6 }],
  },
};
const data = {
  items: [offer],
  accessExpiresAt: null,
  minPacks: 1,
  minAmountToman: "0",
};
test("private DTO preserves real BOM, IDs and all three exact server amounts", () => {
  const result = parseWholesaleCatalog(data);
  assert.equal(result.items[0].pack.id, "pack");
  assert.equal(result.items[0].pack.unitsPerPack, 6);
  assert.equal(result.items[0].packPriceToman, "7407402");
  assert.equal(result.minPacks, 1);
  assert.equal(result.minAmountToman, "0");
});
test("inquiry is not converted to free or assigned another partner price", () => {
  const { unitPriceToman, packPriceToman, ...base } = offer;
  const inquiry = { ...base, pricing: "INQUIRY" };
  const result = parseWholesaleCatalog({ ...data, items: [inquiry] });
  assert.equal(result.items[0].unitPriceToman, undefined);
  assert.throws(() =>
    parseWholesaleCatalog({
      ...data,
      items: [{ ...inquiry, unitPriceToman: "0" }],
    }),
  );
});
test("rejects invalid money, fabricated totals/BOM, duplicate IDs and remote image URLs", () => {
  for (const item of [
    { ...offer, unitPriceToman: "0" },
    { ...offer, unitPriceToman: "1.5" },
    { ...offer, unitPriceToman: "-1" },
    { ...offer, packPriceToman: "1" },
    { ...offer, pack: { ...offer.pack, unitsPerPack: 12 } },
    { ...offer, product: { ...offer.product, image: "//evil.example/x" } },
    { ...offer, product: { ...offer.product, image: "/\\evil.example/x" } },
    { ...offer, validUntil: "not-a-date" },
  ])
    assert.throws(() => parseWholesaleCatalog({ ...data, items: [item] }));
  assert.throws(() =>
    parseWholesaleCatalog({ ...data, items: [offer, offer] }),
  );
});
test("rejects invented minimums and empty/malformed response shapes", () => {
  for (const value of [
    null,
    {},
    [],
    { ...data, minPacks: 2 },
    { ...data, minAmountToman: "1000000" },
  ])
    assert.throws(() => parseWholesaleCatalog(value));
  assert.equal(parseWholesaleCatalog({ ...data, items: [] }).items.length, 0);
});
test("formats exact amounts without floating point truncation", () => {
  assert.equal(
    formatToman("9007199254740993"),
    new Intl.NumberFormat("fa-IR").format(9007199254740993n) + " تومان",
  );
  assert.throws(() => formatToman("1.2"));
});
test("expiry is inclusive with no implicit lifetime or price fallback", () => {
  assert.equal(
    accessExpired({ expiresAt: new Date(1000).toISOString() }, 1000),
    true,
  );
  assert.equal(accessExpired({ expiresAt: null }, 1000), false);
  assert.equal(
    offerExpired({ ...offer, validUntil: new Date(2000).toISOString() }, 1999),
    false,
  );
  assert.equal(
    offerExpired({ ...offer, validUntil: new Date(2000).toISOString() }, 2000),
    true,
  );
});
