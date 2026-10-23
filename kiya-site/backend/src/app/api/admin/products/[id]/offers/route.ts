import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { offerContext, createOffer, offerInput } from "@/server/wholesale";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return endpoint(async () =>
    ok(await offerContext(request, (await params).id)),
  );
}
export async function POST(request: Request, { params }: Context) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await createOffer(
        request,
        (await params).id,
        await readBody(request, offerInput),
      ),
      201,
    );
  });
}
