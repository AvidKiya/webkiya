import { endpoint, ok } from "@/server/http";
import { privateWholesaleCatalog } from "@/server/wholesale";
export async function GET(request: Request) {
  return endpoint(async () => {
    const response = ok(await privateWholesaleCatalog(request));
    response.headers.set("Vary", "Cookie");
    return response;
  });
}
