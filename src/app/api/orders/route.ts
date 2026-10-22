import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { createOrder, listOrders, orderInput } from "@/server/orders";
export async function GET(request: Request) {
  return endpoint(async () => {
    const response = ok(await listOrders(request));
    response.headers.set("Vary", "Cookie");
    return response;
  });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(await createOrder(request, await readBody(request, orderInput)));
  });
}
