import { z } from "zod";
import { endpoint, ok, ApiError, sameOrigin, readBody } from "@/server/http";
import { reviewPartner, reviewInput } from "@/server/partners";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "پرونده پیدا نشد.");
    return ok(
      await reviewPartner(request, id, await readBody(request, reviewInput)),
    );
  });
}
