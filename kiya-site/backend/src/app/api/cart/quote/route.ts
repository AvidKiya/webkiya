import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { quoteCart, quoteInput } from "@/server/cart";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const response = ok(
      await quoteCart(request, await readBody(request, quoteInput)),
    );
    response.headers.set("Vary", "Cookie");
    return response;
  });
}
