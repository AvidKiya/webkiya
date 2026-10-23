import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { createDraft, draftInput } from "@/server/products";
import { GET as modules } from "../[module]/route";
export async function GET(request: Request) {
  return modules(request, { params: Promise.resolve({ module: "products" }) });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await createDraft(request, await readBody(request, draftInput)),
      201,
    );
  });
}
