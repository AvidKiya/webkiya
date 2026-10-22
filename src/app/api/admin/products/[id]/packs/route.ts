import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { listPacks, createPack, packInput } from "@/server/packs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return endpoint(async () => ok(await listPacks(request, (await params).id)));
}
export async function POST(request: Request, { params }: Context) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await createPack(
        request,
        (await params).id,
        await readBody(request, packInput),
      ),
      201,
    );
  });
}
