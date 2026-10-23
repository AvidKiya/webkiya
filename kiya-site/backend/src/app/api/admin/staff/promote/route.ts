import { endpoint, ok, sameOrigin, readBody } from "@/server/http";
import { promoteAccount, promoteInput } from "@/server/access";
export async function POST(r: Request) {
  return endpoint(async () => {
    sameOrigin(r);
    return ok(await promoteAccount(r, await readBody(r, promoteInput)));
  });
}
