import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { createStaff, staffInput } from "@/server/access";
import { GET as modules } from "../[module]/route";
export async function GET(request: Request) {
  return modules(request, { params: Promise.resolve({ module: "staff" }) });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await createStaff(request, await readBody(request, staffInput)),
      201,
    );
  });
}
