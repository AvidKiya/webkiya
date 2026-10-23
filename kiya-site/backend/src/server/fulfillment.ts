import "server-only";
import { z } from "zod";
import { db } from "./db";
import { requireStaff, limit } from "./auth";
import { reauthorize } from "./product-workflow";
import { ApiError } from "./http";
import type { OrderShipment } from "@/generated/prisma/client";
export const fulfillmentInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("prepare"),
      version: z.literal(0),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("ship"),
      version: z.number().int().positive(),
      carrier: z.string().trim().min(2).max(80),
      trackingCode: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9][A-Za-z0-9/-]{3,79}$/),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("deliver"),
      version: z.number().int().positive(),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
]);
export const fulfillmentQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    status: z
      .enum(["ALL", "UNSTARTED", "PREPARING", "SHIPPED", "DELIVERED"])
      .default("ALL"),
  })
  .strict();
export function shipmentDto(value: OrderShipment | null) {
  return value
    ? {
        status: value.status,
        version: value.version,
        carrier: value.carrier,
        trackingCode: value.trackingCode,
        createdAt: value.createdAt,
        shippedAt: value.shippedAt,
        deliveredAt: value.deliveredAt,
      }
    : null;
}
export async function fulfillmentOrders(
  r: Request,
  input: z.infer<typeof fulfillmentQuery>,
) {
  const actor = await requireStaff(r, "order:read");
  await limit("fulfillment-read:" + actor.user.id, 60, 60);
  return db().$transaction(async (tx) => {
    await reauthorize(tx, actor, "order:read");
    const where = {
      status: "PAID",
      ...(input.status === "ALL"
        ? {}
        : input.status === "UNSTARTED"
          ? { shipment: { is: null } }
          : { shipment: { is: { status: input.status } } }),
    };
    const rows = await tx.purchaseOrder.findMany({
      where,
      include: { shipment: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * 20,
      take: 21,
    });
    const visible = rows.slice(0, 20),
      payments = await tx.manualPayment.findMany({
        where: {
          orderId: { in: visible.map((o) => o.id) },
          status: "CONFIRMED",
        },
        select: { orderId: true, shippingAddress: true, amountToman: true },
      });
    return {
      canManage: actor.user.roles.some((r) =>
        r.role.permissions.includes("order:manage"),
      ),
      items: visible.map((o) => {
        const payment = payments.find((p) => p.orderId === o.id);
        return {
          id: o.id,
          mode: o.mode,
          createdAt: o.createdAt,
          snapshot: o.snapshot,
          subtotalToman: o.subtotalToman.toString(),
          amountToman: payment?.amountToman.toString() ?? null,
          shippingAddress: payment?.shippingAddress ?? null,
          shipment: shipmentDto(o.shipment),
        };
      }),
      page: input.page,
      hasMore: rows.length > 20,
    };
  });
}
export async function updateFulfillment(
  r: Request,
  id: string,
  input: z.infer<typeof fulfillmentInput>,
) {
  const actor = await requireStaff(r, "order:manage");
  await limit("fulfillment-write:" + actor.user.id, 60, 60);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${id}::uuid FOR UPDATE`;
    await reauthorize(tx, actor, "order:manage");
    const order = await tx.purchaseOrder.findUnique({ where: { id } }),
      payment = await tx.manualPayment.findUnique({ where: { orderId: id } });
    if (!order) throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
    if (order.status !== "PAID" || payment?.status !== "CONFIRMED")
      throw new ApiError(
        409,
        "PAYMENT_REQUIRED",
        "فقط سفارش دارای پرداخت تأییدشده قابل آماده‌سازی و ارسال است.",
      );
    const prior = await tx.orderShipment.findUnique({ where: { orderId: id } });
    if ((prior?.version ?? 0) !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "وضعیت سفارش تغییر کرده؛ تازه‌سازی کنید.",
      );
    if (
      (input.action === "prepare" && prior) ||
      (input.action === "ship" && prior?.status !== "PREPARING") ||
      (input.action === "deliver" && prior?.status !== "SHIPPED")
    )
      throw new ApiError(
        409,
        "INVALID_TRANSITION",
        "ترتیب آماده‌سازی، ارسال و تحویل باید رعایت شود.",
      );
    const shipment =
      input.action === "prepare"
        ? await tx.orderShipment.create({ data: { orderId: id } })
        : await tx.orderShipment.update({
            where: { orderId: id },
            data: {
              version: { increment: 1 },
              ...(input.action === "ship"
                ? {
                    status: "SHIPPED",
                    carrier: input.carrier,
                    trackingCode: input.trackingCode,
                    shippedAt: new Date(),
                  }
                : { status: "DELIVERED", deliveredAt: new Date() }),
            },
          });
    await tx.auditLog.create({
      data: {
        actorId: actor.user.id,
        action: "order:" + input.action,
        resourceId: id,
        data: {
          reason: input.reason,
          from: prior?.status ?? null,
          to: shipment.status,
          version: shipment.version,
        },
      },
    });
    return shipmentDto(shipment);
  });
}
