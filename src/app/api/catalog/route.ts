import { endpoint, ok } from "@/server/http";
import { publicCatalog } from "@/server/catalog";
export async function GET() {
  return endpoint(async () => ok({ items: await publicCatalog() }));
}
