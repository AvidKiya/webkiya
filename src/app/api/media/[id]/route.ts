import { endpoint } from "@/server/http";
import { serveMedia } from "@/server/media";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => serveMedia(request, (await params).id));
}
