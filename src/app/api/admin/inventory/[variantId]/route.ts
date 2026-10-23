import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { adjustStock, stockInput } from "@/server/inventory";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ variantId: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { variantId } = await params;
    if (!z.uuid().safeParse(variantId).success)
      throw new ApiError(404, "NOT_FOUND", "رنگ پیدا نشد.");
    return ok(
      await adjustStock(
        request,
        variantId,
        await readBody(request, stockInput),
      ),
      201,
    );
  });
}
