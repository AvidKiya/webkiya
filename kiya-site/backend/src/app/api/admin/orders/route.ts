import { endpoint, ok, ApiError } from "@/server/http";
import { fulfillmentOrders, fulfillmentQuery } from "@/server/fulfillment";
export async function GET(r: Request) {
  return endpoint(async () => {
    const parsed = fulfillmentQuery.safeParse(
      Object.fromEntries(new URL(r.url).searchParams),
    );
    if (!parsed.success)
      throw new ApiError(422, "VALIDATION", "فیلتر سفارش معتبر نیست.");
    return ok(await fulfillmentOrders(r, parsed.data));
  });
}
