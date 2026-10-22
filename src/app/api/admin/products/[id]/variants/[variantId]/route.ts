import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { editVariant, variantEditInput } from "@/server/product-workflow";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id, variantId } = await params;
    if (!z.uuid().safeParse(variantId).success)
      throw new ApiError(404, "NOT_FOUND", "رنگ پیدا نشد.");
    return ok(
      await editVariant(
        request,
        id,
        variantId,
        await readBody(request, variantEditInput),
      ),
    );
  });
}
