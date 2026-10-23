import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { editRole, editRoleInput } from "@/server/access";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "نقش پیدا نشد.");
    return ok(
      await editRole(request, id, await readBody(request, editRoleInput)),
    );
  });
}
