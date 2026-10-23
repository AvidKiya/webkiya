import { endpoint, ok, sameOrigin, ApiError } from "@/server/http";
import { z } from "zod";
import { uploadReceipt, receiptImage } from "@/server/manual-payments";
type C = { params: Promise<{ id: string }> };
async function id(c: C) {
  const value = (await c.params).id;
  if (!z.uuid().safeParse(value).success)
    throw new ApiError(404, "NOT_FOUND", "رسید پیدا نشد.");
  return value;
}
export async function POST(r: Request, c: C) {
  return endpoint(async () => {
    sameOrigin(r);
    return ok(await uploadReceipt(r, await id(c)));
  });
}
export async function GET(r: Request, c: C) {
  return endpoint(
    async () =>
      new Response(new Uint8Array(await receiptImage(r, await id(c))), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": 'inline; filename="receipt.webp"',
        },
      }),
  );
}
