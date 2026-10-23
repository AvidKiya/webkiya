import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import {
  supportList,
  supportCreate,
  listSupport,
  createSupport,
} from "@/server/support";
export async function GET(r: Request) {
  return endpoint(async () => {
    const input = supportList.safeParse(
      Object.fromEntries(new URL(r.url).searchParams),
    );
    if (!input.success)
      throw new ApiError(422, "VALIDATION", "فیلتر گفت‌وگو معتبر نیست.");
    return ok(await listSupport(r, input.data, false));
  });
}
export async function POST(r: Request) {
  return endpoint(async () => {
    sameOrigin(r);
    return ok(await createSupport(r, await readBody(r, supportCreate)), 201);
  });
}
