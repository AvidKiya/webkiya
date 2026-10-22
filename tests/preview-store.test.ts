import { describe, it, expect } from "vitest";
import { parsePreview } from "../src/lib/preview-store";
import { products } from "../src/lib/catalog";
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
});
