import { z } from "zod";
import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import {
  supportHistory,
  supportMessage,
  supportStatus,
  readSupport,
  sendSupport,
  statusSupport,
} from "@/server/support";
type Context = { params: Promise<{ id: string }> };
async function idOf(c: Context) {
  const { id } = await c.params;
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "NOT_FOUND", "گفت‌وگو پیدا نشد.");
  return id;
}
export async function GET(r: Request, c: Context) {
  return endpoint(async () => {
    const input = supportHistory.safeParse(
      Object.fromEntries(new URL(r.url).searchParams),
    );
    if (!input.success)
      throw new ApiError(422, "VALIDATION", "صفحهٔ پیام‌ها معتبر نیست.");
    return ok(await readSupport(r, await idOf(c), input.data, false));
  });
}
export async function POST(r: Request, c: Context) {
  return endpoint(async () => {
    sameOrigin(r);
    return ok(
      await sendSupport(
        r,
        await idOf(c),
        await readBody(r, supportMessage),
        false,
      ),
      201,
    );
  });
}
export async function PATCH(r: Request, c: Context) {
  return endpoint(async () => {
    sameOrigin(r);
    return ok(
      await statusSupport(
        r,
        await idOf(c),
        await readBody(r, supportStatus),
        false,
      ),
    );
  });
}
