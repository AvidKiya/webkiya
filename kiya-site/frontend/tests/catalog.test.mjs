import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptCatalog } from "../src/services/catalog.ts";
const item = {
  id: "real-product",
  name: "کالای سرور",
  subtitle: "توضیح",
  description: "متن کالا",
  category: "لباس زیر",
  image: "/api/media/abc",
  price: "125000",
  availableUnits: 7,
  isDemo: false,
  colors: [{ id: "colour-1", name: "مشکی" }],
};
test("uses server IDs, exact display money and net stock with no fabricated wholesale offer", () => {
  const data = adaptCatalog([item]);
  assert.equal(data.products[0].id, item.id);
  assert.equal(data.posts[0].id, item.id);
  assert.equal(data.products[0].stock, 7);
  assert.equal(data.products[0].price, 125000);
  assert.equal(data.products[0].packDefinition.priceMode, "INQUIRY");
  assert.equal(data.products[0].packDefinition.id, "");
  assert.equal(data.products[0].costToman, undefined);
  assert.equal(data.products[0].serverManaged, true);
});
test("empty API result remains empty, never replaced with template fixtures", () =>
  assert.deepEqual(adaptCatalog([]), { products: [], posts: [] }));
test("rejects malformed responses, duplicate IDs and impossible inventory", () => {
  for (const data of [
    undefined,
    {},
    [item, item],
    [{ ...item, availableUnits: -1 }],
    [{ ...item, availableUnits: 1.5 }],
    [{ ...item, image: "https://untrusted.example/image" }],
  ])
    assert.throws(() => adaptCatalog(data));
});
test("rejects unsafe/negative/fractional prices instead of changing the amount", () => {
  for (const price of ["-1", "1.5", "NaN", "9007199254740993", null])
    assert.throws(() => adaptCatalog([{ ...item, price }]));
  assert.equal(
    adaptCatalog([{ ...item, price: "125000.00" }]).products[0].price,
    125000,
  );
});
test("unknown catalog category does not silently become ordinary apparel", () =>
  assert.equal(
    adaptCatalog([{ ...item, category: "دسته جدید" }]).products[0].categorySlug,
    "other",
  ));
