import { endpoint, ok, sameOrigin, readBody, ApiError } from "@/server/http";
import { z } from "zod";
import { reviewTransfer, reviewPaymentInput } from "@/server/manual-payments";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    sameOrigin(r);
    const { id } = await c.params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "پرداخت پیدا نشد.");
    return ok(
      await reviewTransfer(r, id, await readBody(r, reviewPaymentInput)),
    );
  });
}
