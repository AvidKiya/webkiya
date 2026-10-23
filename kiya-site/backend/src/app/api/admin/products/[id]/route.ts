import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { editDraft, editDraftInput } from "@/server/products";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id } = await params;
    if (id.length > 80) throw new ApiError(404, "NOT_FOUND", "کالا پیدا نشد.");
    return ok(
      await editDraft(request, id, await readBody(request, editDraftInput)),
    );
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const { productDetails } = await import("@/server/product-workflow");
    return ok(await productDetails(request, (await params).id));
  });
}
