import { endpoint, ok } from "@/server/http";
import { listOrdersForStaff } from "@/server/order-admin";
export async function GET(request: Request) {
  return endpoint(async () => {
    const response = ok(
      await listOrdersForStaff(request, new URL(request.url)),
    );
    response.headers.set("Vary", "Cookie");
    return response;
  });
}
