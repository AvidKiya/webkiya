import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { cancelOrder, cancelInput, orderId } from "@/server/orders";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const id = orderId.safeParse((await context.params).id);
    if (!id.success) throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
    return ok(
      await cancelOrder(request, id.data, await readBody(request, cancelInput)),
    );
  });
}
