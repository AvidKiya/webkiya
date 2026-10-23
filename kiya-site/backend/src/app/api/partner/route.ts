import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { applyPartner, partnerInput } from "@/server/partners";
export async function GET(request: Request) {
  return endpoint(async () => {
    const current = await requireUser(request);
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
    return ok({
      application: p,
      // Legacy checkout-readiness flag; private price display is separate.
      pricingReady: false,
      privatePricingAvailable: true,
      orderReady: false,
      minPacks: 1,
      minAmountToman: "0",
    });
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
