import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "CONTENT_TYPE", "درخواست باید JSON باشد.");
  const tooLarge = () =>
    new ApiError(413, "BODY_TOO_LARGE", "حجم درخواست بیش از حد مجاز است.");
  if (Number(request.headers.get("content-length") || 0) > 16384)
    throw tooLarge();
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
    return schema.parse(JSON.parse(text));
  } catch {
    throw new ApiError(422, "VALIDATION", "اطلاعات واردشده معتبر نیست.");
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new ApiError(403, "ORIGIN", "مبدأ درخواست معتبر نیست.");
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw new ApiError(403, "ORIGIN", "مبدأ درخواست معتبر نیست.");
  }
  const allowed = [new URL(request.url).host, request.headers.get("host")];
  if (process.env.NEXT_PUBLIC_SITE_URL)
    allowed.push(new URL(process.env.NEXT_PUBLIC_SITE_URL).host);
  if (!allowed.includes(host))
    throw new ApiError(403, "ORIGIN", "مبدأ درخواست معتبر نیست.");
}
export function ok(data: unknown, status = 200) {
  return NextResponse.json(
    { ok: true, data },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
      },
    },
  );
}
export async function endpoint(
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    const known = error instanceof ApiError;
    const id = randomUUID();
    // Never log request bodies, cookies, phone numbers, seeds or password hashes.
    if (!known)
      console.error("KIYA API failure", {
        requestId: id,
        type: error instanceof Error ? error.name : "Unknown",
      });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: known ? error.code : "SERVICE_UNAVAILABLE",
          message: known
            ? error.message
            : "سرویس موقتاً در دسترس نیست. دوباره تلاش کنید.",
        },
        requestId: id,
      },
      {
        status: known ? error.status : 503,
        headers: {
          "Cache-Control": "no-store",
          ...(known && error.status === 429 ? { "Retry-After": "60" } : {}),
        },
      },
    );
  }
}
