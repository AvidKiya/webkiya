import { endpoint, ok } from "@/server/http";
import { accessData } from "@/server/access";
export async function GET(request: Request) {
  return endpoint(async () => ok(await accessData(request)));
}
