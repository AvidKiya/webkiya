import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { editPack, editPackInput } from "@/server/packs";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id, packId } = await params;
    if (!z.uuid().safeParse(packId).success)
      throw new ApiError(404, "NOT_FOUND", "جین پیدا نشد.");
    return ok(
      await editPack(
        request,
        id,
        packId,
        await readBody(request, editPackInput),
      ),
    );
  });
}
