import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import {
  cartMode,
  readCart,
  addCart,
  changeCart,
  addCartInput,
  changeCartInput,
} from "@/server/cart";
export async function GET(request: Request) {
  return endpoint(async () => {
    const parsed = cartMode.safeParse(
      new URL(request.url).searchParams.get("mode") || "RETAIL",
    );
    if (!parsed.success)
      throw new ApiError(422, "INVALID_MODE", "نوع سبد معتبر نیست.");
    const response = ok(await readCart(request, parsed.data));
    response.headers.set("Vary", "Cookie");
    return response;
  });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(await addCart(request, await readBody(request, addCartInput)));
  });
}
export async function PATCH(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await changeCart(request, await readBody(request, changeCartInput)),
    );
  });
}
