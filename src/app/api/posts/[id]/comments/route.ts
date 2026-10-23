import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { session } from "@/server/auth";
import {
  listComments,
  listReplies,
  createComment,
  commentInput,
} from "@/server/comments";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, context: Context) {
  return endpoint(async () => {
    const { id } = await context.params;
    const query = new URL(request.url).searchParams;
    const cursor = query.get("cursor") || undefined;
    const root = query.get("root") || undefined;
    if (root && !z.uuid().safeParse(root).success)
      throw new ApiError(422, "VALIDATION", "دیدگاه معتبر نیست.");
    if (cursor && !z.uuid().safeParse(cursor).success)
      throw new ApiError(422, "VALIDATION", "صفحه‌بندی معتبر نیست.");
    return ok(
      root
        ? await listReplies(id, root, await session(request), cursor)
        : await listComments(id, await session(request), cursor),
    );
  });
}
export async function POST(request: Request, context: Context) {
  return endpoint(async () => {
    sameOrigin(request);
    const { id } = await context.params;
    return ok(
      await createComment(request, id, await readBody(request, commentInput)),
      201,
    );
  });
}
