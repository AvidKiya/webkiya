import { z } from "zod";
import { endpoint, ok, sameOrigin, readBody, ApiError } from "@/server/http";
import { fulfillmentInput, updateFulfillment } from "@/server/fulfillment";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    sameOrigin(r);
    const { id } = await c.params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
    return ok(
      await updateFulfillment(r, id, await readBody(r, fulfillmentInput)),
    );
  });
}
