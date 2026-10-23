import { endpoint, ok } from "@/server/http";
import { inventory } from "@/server/inventory";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => ok(await inventory(request, (await params).id)));
}
