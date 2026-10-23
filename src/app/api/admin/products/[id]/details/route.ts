import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { saveDetails, detailsInput } from "@/server/product-workflow";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await saveDetails(
        request,
        (await params).id,
        await readBody(request, detailsInput),
      ),
    );
  });
}
