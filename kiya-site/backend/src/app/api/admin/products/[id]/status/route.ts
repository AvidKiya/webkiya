import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { changeStatus, statusInput } from "@/server/product-workflow";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await changeStatus(
        request,
        (await params).id,
        await readBody(request, statusInput),
      ),
    );
  });
}
