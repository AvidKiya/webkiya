import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import {
  decideOrder,
  orderDecisionInput,
  orderForStaff,
} from "@/server/order-admin";
async function id(params: Promise<{ id: string }>) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
  return parsed.data;
}
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const response = ok(await orderForStaff(request, await id(context.params)));
    response.headers.set("Vary", "Cookie");
    return response;
  });
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await decideOrder(
        request,
        await id(context.params),
        await readBody(request, orderDecisionInput),
      ),
    );
  });
}
