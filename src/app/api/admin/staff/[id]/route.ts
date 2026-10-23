import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { editStaff, editStaffInput } from "@/server/access";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "پرسنل پیدا نشد.");
    return ok(
      await editStaff(request, id, await readBody(request, editStaffInput)),
    );
  });
}
