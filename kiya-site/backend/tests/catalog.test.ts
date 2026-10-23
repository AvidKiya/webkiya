import { describe, it, expect } from "vitest";
import { products, cartTotal, validCart, money } from "../src/lib/catalog";
describe("Preview catalog and cart (not a financial backend)", () => {
  it("has unique products and no private wholesale prices", () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    for (const p of products) {
      expect(p).not.toHaveProperty("wholesalePrice");
      expect(p.packSize).toBeGreaterThan(0);
      expect(BigInt(p.price)).toBeGreaterThan(0n);
    }
  });
  it("totals integer string amounts exactly", () => {
    expect(
      cartTotal([
        {
          productId: products[0].id,
          color: products[0].colors[0].name,
          qty: 2,
        },
      ]),
    ).toBe((BigInt(products[0].price) * 2n).toString());
    expect(cartTotal([])).toBe("0");
  });
  it("rejects forged, negative, fractional and oversized cart entries", () => {
    for (const qty of [-1, 0, 1.5, 21, "1"])
      expect(
        validCart([
          { productId: products[0].id, color: products[0].colors[0].name, qty },
        ]),
      ).toEqual([]);
    expect(validCart([{ productId: "unknown", color: "red", qty: 1 }])).toEqual(
      [],
    );
    expect(validCart(null)).toEqual([]);
  });
  it("accepts only existing color options", () => {
    expect(
      validCart([{ productId: products[0].id, color: "forged", qty: 1 }]),
    ).toEqual([]);
    expect(
      validCart([
        {
          productId: products[0].id,
          color: products[0].colors[0].name,
          qty: 1,
        },
      ]),
    ).toHaveLength(1);
  });
  it("formats prices in Persian", () => {
    expect(money("1450000")).toBe("۱٬۴۵۰٬۰۰۰");
  });
});
