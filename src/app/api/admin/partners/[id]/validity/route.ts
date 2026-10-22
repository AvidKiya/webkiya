import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { setPartnerValidity, validityInput } from "@/server/wholesale";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "پرونده پیدا نشد.");
    return ok(
      await setPartnerValidity(
        request,
        id,
        await readBody(request, validityInput),
      ),
    );
  });
}
