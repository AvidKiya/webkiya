import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { setOfferStatus, offerStatusInput } from "@/server/wholesale";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id, offerId } = await params;
    if (!z.uuid().safeParse(offerId).success)
      throw new ApiError(404, "NOT_FOUND", "قیمت پیدا نشد.");
    return ok(
      await setOfferStatus(
        request,
        id,
        offerId,
        await readBody(request, offerStatusInput),
      ),
    );
  });
}
