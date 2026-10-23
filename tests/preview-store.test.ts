import { describe, it, expect } from "vitest";
import { parsePreview } from "../src/lib/preview-store";
import { products, cartTotal } from "../src/lib/catalog";
const id = products[0].id;
describe("Local preview storage validation", () => {
  it("tolerates malformed JSON", () => {
    expect(parsePreview("{oops").cart).toEqual([]);
    expect(parsePreview("null").saved).toEqual([]);
  });
  it("deduplicates known liked/saved IDs", () => {
    expect(
      parsePreview(JSON.stringify({ liked: [id, id, "unknown"], saved: [id] }))
        .liked,
    ).toEqual([id]);
  });
  it("ignores legacy local comments instead of publishing private browser data", () => {
    expect(
      parsePreview(
        JSON.stringify({
          comments: {
            [id]: [{ id: "legacy", name: "private", text: "private" }],
          },
        }),
      ),
    ).not.toHaveProperty("comments");
  });
  it("drops invalid cart lines while preserving valid colors and quantities", () => {
    expect(
      parsePreview(
        JSON.stringify({
          cart: [
            { productId: id, color: "invalid", qty: 1 },
            { productId: id, color: products[0].colors[0].name, qty: 2 },
          ],
        }),
      ).cart,
    ).toHaveLength(1);
  });
  it("never treats local account or price fields as authentication", () => {
    const parsed = parsePreview(
      JSON.stringify({ approved: true, wholesalePrice: "1", role: "OWNER" }),
    );
    expect(parsed).not.toHaveProperty("approved");
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("wholesalePrice");
  });
  it("accepts database product IDs only from the runtime public catalog", () => {
    const product = {
      ...products[0],
      id: "draft-real-public",
      isDemo: false,
      price: "12345",
    };
    const raw = JSON.stringify({
      cart: [{ productId: product.id, color: product.colors[0].name, qty: 2 }],
      saved: [product.id],
      liked: [product.id],
    });
    expect(parsePreview(raw, [product]).cart).toHaveLength(1);
    expect(parsePreview(raw, []).cart).toHaveLength(0);
    expect(parsePreview(raw, [product]).saved).toEqual([product.id]);
    expect(cartTotal(parsePreview(raw, [product]).cart, [product])).toBe(
      "24690",
    );
  });
  it("uses current catalog prices, never a stale fixture or local price field", () => {
    const current = { ...products[0], price: "99" };
    const data = parsePreview(
      JSON.stringify({
        cart: [
          {
            productId: current.id,
            color: current.colors[0].name,
            qty: 2,
            price: "1",
          },
        ],
      }),
      [current],
    );
    expect(cartTotal(data.cart, [current])).toBe("198");
    expect(data.cart[0]).not.toHaveProperty("price");
  });
});
