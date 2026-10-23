import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { z } from "zod";
import {
  transferForOrder,
  createTransfer,
  transferInput,
} from "@/server/manual-payments";
export async function GET(r: Request) {
  return endpoint(async () => {
    const id = z.uuid().safeParse(new URL(r.url).searchParams.get("orderId"));
    if (!id.success)
      throw new ApiError(422, "ORDER_ID", "شناسه سفارش معتبر نیست.");
    return ok(await transferForOrder(r, id.data));
  });
}
export async function POST(r: Request) {
  return endpoint(async () => {
    sameOrigin(r);
    return ok(await createTransfer(r, await readBody(r, transferInput)));
  });
}
