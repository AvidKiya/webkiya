import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { addVariant, variantInput } from "@/server/product-workflow";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await addVariant(
        request,
        (await params).id,
        await readBody(request, variantInput),
      ),
      201,
    );
  });
}
