import { endpoint, ok, sameOrigin } from "@/server/http";
import { uploadMedia } from "@/server/media";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(await uploadMedia(request), 201);
  });
}
