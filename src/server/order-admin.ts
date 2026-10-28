import "server-only";
import { z } from "zod";
import { db } from "./db";
import { requireStaff, limit } from "./auth";
import { ApiError } from "./http";
import { reauthorize } from "./product-workflow";

export const ORDER_STATUSES = [
  "RESERVED",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const FULFILMENT_STATUSES = [
  "PREPARING",
  "SHIPPED",
  "COMPLETED",
] as const;
const NEXT: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  CONFIRMED: ["PREPARING", "SHIPPED", "COMPLETED"],
  PREPARING: ["SHIPPED", "COMPLETED"],
  SHIPPED: ["COMPLETED"],
};
export const orderDecisionInput = z
  .object({
    action: z.enum(["CONFIRM", "ADVANCE"]),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
    next: z.enum(FULFILMENT_STATUSES).optional(),
  })
  .strict()
  .refine((v) => v.action === "ADVANCE" || v.next === undefined, {
    message: "ثبت تأیید نباید وضعیت بعدی داشته باشد.",
  })
  .refine((v) => v.action !== "ADVANCE" || v.next !== undefined, {
    message: "وضعیت بعدی لازم است.",
  });

type SnapshotLine = {
  name?: string;
  selection?: string;
  quantity?: number;
  totalUnits?: number;
  lineTotalToman?: string | number;
};
function snapshotLines(snapshot: unknown): SnapshotLine[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const lines = (snapshot as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return [];
  return lines.filter((l): l is SnapshotLine => !!l && typeof l === "object");
}
export function maskPhone(phone: string | null | undefined) {
  if (!phone) return null;
  return phone.length > 4
    ? "•".repeat(phone.length - 4) + phone.slice(-4)
    : "•";
}
type OrderRow = {
  id: string;
  mode: string;
  status: string;
  version: number;
  subtotalToman: { toString(): string };
  snapshot: unknown;
  createdAt: Date;
  reservedUntil: Date;
  endedAt: Date | null;
  user: { displayName: string; isDemo: boolean; phone: string | null };
};
function dto(order: OrderRow) {
  const lines = snapshotLines(order.snapshot);
  return {
    id: order.id,
    mode: order.mode,
    status: order.status,
    version: order.version,
    subtotalToman: order.subtotalToman.toString(),
    createdAt: order.createdAt,
    reservedUntil: order.reservedUntil,
    endedAt: order.endedAt,
    customer: {
      displayName: order.user.displayName,
      isDemo: order.user.isDemo,
      phone: maskPhone(order.user.phone),
    },
    lines: lines.map((l) => ({
      name: l.name || "کالا",
      selection: l.selection || "",
      quantity: Number(l.quantity || 0),
      totalUnits: Number(l.totalUnits || l.quantity || 0),
      lineTotalToman: String(l.lineTotalToman ?? "0"),
    })),
    expiry:
      order.status === "RESERVED" &&
      order.reservedUntil.getTime() <= Date.now(),
  };
}
const listSelect = {
  id: true,
  mode: true,
  status: true,
  version: true,
  subtotalToman: true,
  snapshot: true,
  createdAt: true,
  reservedUntil: true,
  endedAt: true,
  user: { select: { displayName: true, isDemo: true, phone: true } },
} as const;
function statusFilter(value: string | null): OrderStatus | undefined {
  return ORDER_STATUSES.find((s) => s === value);
}
export async function listOrdersForStaff(request: Request, url: URL) {
  await requireStaff(request, "order:read");
  const status = statusFilter(url.searchParams.get("status"));
  const [orders, counts] = await Promise.all([
    db().purchaseOrder.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: listSelect,
    }),
    db().purchaseOrder.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    orders: orders.map(dto),
    counts: Object.fromEntries(
      ORDER_STATUSES.map((s) => [
        s,
        counts.find((c) => c.status === s)?._count._all ?? 0,
      ]),
    ),
    openStatuses: ["RESERVED", "CONFIRMED", "PREPARING", "SHIPPED"],
    limit: 50,
  };
}
export async function orderForStaff(request: Request, id: string) {
  await requireStaff(request, "order:read");
  const order = await db().purchaseOrder.findUnique({
    where: { id },
    select: {
      ...listSelect,
      holds: {
        orderBy: { variantId: "asc" },
        select: {
          units: true,
          variant: {
            select: { sku: true, name: true, stock: true, reserved: true },
          },
        },
      },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
          actor: { select: { displayName: true } },
        },
      },
    },
  });
  if (!order) throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
  return {
    ...dto(order),
    holds: order.holds.map((h) => ({
      sku: h.variant.sku,
      name: h.variant.name,
      units: h.units,
      stock: h.variant.stock,
      reserved: h.variant.reserved,
    })),
    events: order.events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      reason: e.reason,
      createdAt: e.createdAt,
      actor: e.actor.displayName,
    })),
    allowedNext: NEXT[order.status as OrderStatus] || [],
  };
}
function isConstraintError(error: unknown) {
  const e = error as { code?: string; meta?: { code?: string } };
  return [e?.code, e?.meta?.code].some((c) => c === "23514" || c === "23503");
}
export async function decideOrder(
  request: Request,
  id: string,
  input: z.infer<typeof orderDecisionInput>,
) {
  const current = await requireStaff(request, "order:manage");
  await limit("order-manage:" + current.user.id, 60, 60);
  return db().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${id}::uuid FOR UPDATE`;
      const order = await tx.purchaseOrder.findUnique({ where: { id } });
      await reauthorize(tx, current, "order:manage");
      if (!order) throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
      if (order.version !== input.version)
        throw new ApiError(
          409,
          "STALE_VERSION",
          "سفارش تغییر کرده؛ تازه‌سازی کنید.",
        );
      if (input.action === "CONFIRM") {
        if (order.status !== "RESERVED")
          throw new ApiError(
            409,
            "INVALID_STATE",
            "فقط سفارش رزروشده قابل تأیید است.",
          );
        if (order.reservedUntil <= new Date())
          throw new ApiError(
            409,
            "RESERVATION_EXPIRED",
            "مهلت رزرو تمام شده؛ سفارش را منقضی کنید.",
          );
        try {
          await tx.$queryRaw`SELECT kiya_confirm_order(${id}::uuid,${current.user.id}::uuid,${input.reason}) AS confirmed`;
        } catch (error) {
          if (isConstraintError(error))
            throw new ApiError(
              409,
              "STOCK_CONFLICT",
              "موجودی کافی برای تأیید این سفارش نیست.",
            );
          throw error;
        }
      } else {
        const next = input.next as OrderStatus;
        const allowed = NEXT[order.status as OrderStatus] || [];
        if (!allowed.includes(next))
          throw new ApiError(
            409,
            "INVALID_STATE",
            "این تغییر وضعیت برای سفارش مجاز نیست.",
          );
        try {
          await tx.$queryRaw`SELECT kiya_advance_order(${id}::uuid,${next},${current.user.id}::uuid,${input.reason}) AS advanced`;
        } catch (error) {
          if (isConstraintError(error))
            throw new ApiError(
              409,
              "INVALID_STATE",
              "تغییر وضعیت با قواعد سفارش نمی‌خواند.",
            );
          throw error;
        }
      }
      const updated = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        select: listSelect,
      });
      return dto(updated);
    },
    { timeout: 15000 },
  );
}
