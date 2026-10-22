import { endpoint, ok, ApiError } from "@/server/http";
import { requireStaff, type Permission } from "@/server/auth";
import { db } from "@/server/db";
const modules: Record<string, Permission> = {
  dashboard: "dashboard:read",
  comments: "comment:read",
  partners: "partner:read",
  products: "product:read",
  staff: "staff:read",
  audit: "audit:read",
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  return endpoint(async () => {
    const { module } = await params;
    const permission = modules[module];
    if (!permission) throw new ApiError(404, "NOT_FOUND", "بخش پیدا نشد.");
    await requireStaff(request, permission);
    if (module === "dashboard") {
      const [customers, comments, pending, products] = await Promise.all([
        db().user.count({ where: { kind: "CUSTOMER", isActive: true } }),
        db().comment.count({ where: { status: "VISIBLE" } }),
        db().partnerAccount.count({ where: { status: "PENDING" } }),
        db().product.count({ where: { status: "PUBLISHED" } }),
      ]);
      return ok({
        customers,
        comments,
        pending,
        products,
        mode: process.env.APP_MODE === "demo" ? "demo" : "live",
        paymentReady: false,
      });
    }
    if (module === "comments")
      return ok(
        await db().comment.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            postId: true,
            body: true,
            status: true,
            createdAt: true,
            author: { select: { displayName: true, isDemo: true } },
          },
        }),
      );
    if (module === "partners")
      return ok(
        await db().partnerAccount.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            businessName: true,
            city: true,
            note: true,
            status: true,
            version: true,
            createdAt: true,
            user: { select: { displayName: true, isDemo: true } },
          },
        }),
      );
    if (module === "products")
      return ok(
        await db().product.findMany({
          take: 50,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            name: true,
            status: true,
            price: true,
            version: true,
          },
        }),
      );
    if (module === "staff")
      return ok(
        await db().user.findMany({
          where: { kind: "STAFF" },
          take: 50,
          select: {
            id: true,
            displayName: true,
            isActive: true,
            mfaEnabled: true,
            roles: { select: { role: { select: { key: true, name: true } } } },
          },
        }),
      );
    return ok(
      await db().auditLog.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        select: { id: true, action: true, resourceId: true, createdAt: true },
      }),
    );
  });
}
