import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const current = await requireStaff(request, "comment:moderate");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "دیدگاه پیدا نشد.");
    const input = await readBody(
      request,
      z
        .object({
          status: z.enum(["VISIBLE", "HIDDEN"]),
          reason: z.string().trim().min(3).max(500),
        })
        .strict(),
    );
    return ok(
      await db().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Comment" WHERE "id"=${id}::uuid FOR UPDATE`;
        const c = await tx.comment.findUnique({ where: { id } });
        if (!c || c.status === "DELETED")
          throw new ApiError(
            409,
            "COMMENT_UNAVAILABLE",
            "دیدگاه حذف شده یا در دسترس نیست.",
          );
        await tx.comment.update({
          where: { id },
          data: { status: input.status },
        });
        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            action: "comment:moderate",
            resourceId: id,
            data: { from: c.status, to: input.status, reason: input.reason },
          },
        });
        return { id, status: input.status };
      }),
    );
  });
}
