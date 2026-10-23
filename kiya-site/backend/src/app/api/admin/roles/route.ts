import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { createRole, roleInput } from "@/server/access";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await createRole(request, await readBody(request, roleInput)),
      201,
    );
  });
}
