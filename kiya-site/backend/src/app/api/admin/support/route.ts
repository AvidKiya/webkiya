import { endpoint, ok, ApiError } from "@/server/http";
import { supportList, listSupport } from "@/server/support";
export async function GET(r: Request) {
  return endpoint(async () => {
    const input = supportList.safeParse(
      Object.fromEntries(new URL(r.url).searchParams),
    );
    if (!input.success)
      throw new ApiError(422, "VALIDATION", "فیلتر گفت‌وگو معتبر نیست.");
    return ok(await listSupport(r, input.data, true));
  });
}
