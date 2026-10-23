import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { setPackStatus, packStatusInput } from "@/server/packs";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id, packId } = await params;
    if (!z.uuid().safeParse(packId).success)
      throw new ApiError(404, "NOT_FOUND", "جین پیدا نشد.");
    return ok(
      await setPackStatus(
        request,
        id,
        packId,
        await readBody(request, packStatusInput),
      ),
    );
  });
}
