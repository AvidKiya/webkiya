import { NextRequest, NextResponse } from "next/server";
import { STORE_SECTIONS } from "@/lib/routes";
import { publicProduct } from "@/server/catalog";
// Resolve absence before RSC streaming starts so unknown/unpublished posts have
// an HTTP 404, rather than only a streamed not-found screen with status 200.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname,
    parts = path.split("/").filter(Boolean);
  const missing = () =>
    NextResponse.rewrite(new URL("/_not-found", request.url), {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (parts[0] === "p" && parts.length === 2) {
    const id = parts[1];
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !(await publicProduct(id)))
      return missing();
  } else if (
    parts.length === 1 &&
    parts[0] !== "admin" &&
    parts[0] !== "progress" &&
    !STORE_SECTIONS.some((s) => s === parts[0])
  )
    return missing();
  return NextResponse.next();
}
export const config = { matcher: ["/:section", "/p/:id"] };
