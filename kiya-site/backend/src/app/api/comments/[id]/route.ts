import { z } from "zod";
import { endpoint, ok, sameOrigin, ApiError } from "@/server/http";
import { removeComment } from "@/server/comments";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "دیدگاه پیدا نشد.");
    return ok(await removeComment(request, id));
  });
}
