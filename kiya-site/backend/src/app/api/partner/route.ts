import { endpoint, ok, readBody, sameOrigin, ApiError } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { applyPartner, partnerInput } from "@/server/partners";
export async function GET(request: Request) {
  return endpoint(async () => {
    const current = await requireUser(request);
    if (current.user.kind !== "CUSTOMER")
      throw new ApiError(
        403,
        "CUSTOMER_REQUIRED",
        "این بخش فقط برای حساب مشتری است.",
      );
    const p = await db().partnerAccount.findUnique({
      where: { userId: current.user.id },
      select: {
        id: true,
        status: true,
        businessName: true,
        city: true,
        note: true,
        reason: true,
        version: true,
        expiresAt: true,
        updatedAt: true,
      },
    });
    const response = ok({
      application: p,
      // Legacy checkout-readiness flag; private price display is separate.
      pricingReady: false,
      privatePricingAvailable: true,
      orderReady: false,
      minPacks: 1,
      minAmountToman: "0",
    });
    response.headers.set("Vary", "Cookie");
    return response;
  });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return ok(
      await applyPartner(request, await readBody(request, partnerInput)),
      201,
    );
  });
}
