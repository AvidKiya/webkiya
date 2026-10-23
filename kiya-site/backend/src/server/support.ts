import "server-only";
import { z } from "zod";
import { db, type Transaction } from "./db";
import { hash } from "./crypto";
import { customer } from "./cart";
import { freshCustomer } from "./wholesale";
import { requireStaff, limit, type AuthSession, type Permission } from "./auth";
import { reauthorize } from "./product-workflow";
import { ApiError } from "./http";
import type { SupportThread, SupportMessage } from "@/generated/prisma/client";
const body = z
  .string()
  .trim()
  .min(1)
  .max(3000)
  .refine(
    (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value),
  );
export const supportCreate = z
  .object({
    requestId: z.uuid(),
    subject: z.string().trim().min(3).max(120),
    body,
    orderId: z.uuid().optional(),
  })
  .strict();
export const supportMessage = z
  .object({ requestId: z.uuid(), body, internal: z.boolean().default(false) })
  .strict();
export const supportStatus = z
  .object({
    status: z.enum(["OPEN", "CLOSED"]),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();
export const supportList = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL"),
  })
  .strict();
export const supportHistory = z
  .object({ before: z.uuid().optional() })
  .strict();
function threadDto(t: SupportThread) {
  return {
    id: t.id,
    subject: t.subject,
    orderId: t.orderId,
    status: t.status,
    version: t.version,
    createdAt: t.createdAt,
    updatedAt: t.publicUpdatedAt,
  };
}
function messageDto(m: SupportMessage) {
  return {
    id: m.id,
    body: m.body,
    authorKind: m.authorKind,
    internal: m.internal,
    createdAt: m.createdAt,
  };
}
const permitted = (actor: AuthSession, p: Permission) =>
  actor.user.roles.some((r) => r.role.permissions.includes(p));
async function auth(
  r: Request,
  admin: boolean,
  p: Permission = "support:read",
) {
  const actor = admin ? await requireStaff(r, p) : await customer(r);
  await limit("support-api:" + actor.user.id, 90, 60);
  return actor;
}
async function check(
  tx: Transaction,
  actor: AuthSession,
  admin: boolean,
  p: Permission = "support:read",
) {
  if (admin) {
    await reauthorize(tx, actor, "support:read");
    if (p !== "support:read") await reauthorize(tx, actor, p);
  } else await freshCustomer(tx, actor);
}
async function owned(
  tx: Transaction,
  id: string,
  actor: AuthSession,
  admin: boolean,
) {
  const thread = await tx.supportThread.findFirst({
    where: { id, ...(admin ? {} : { userId: actor.user.id }) },
  });
  if (!thread) throw new ApiError(404, "NOT_FOUND", "گفت‌وگو پیدا نشد.");
  return thread;
}
async function openCapacity(tx: Transaction, userId: string) {
  if (
    (await tx.supportThread.count({ where: { userId, status: "OPEN" } })) >= 10
  )
    throw new ApiError(
      409,
      "OPEN_LIMIT",
      "حداکثر ده درخواست باز مجاز است؛ ابتدا درخواست قبلی را پیگیری یا ببندید.",
    );
}
function mutationConflict(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ApiError(
      409,
      "REQUEST_CONFLICT",
      "شناسهٔ درخواست هم‌زمان برای عملیات دیگری استفاده شده است.",
    );
  throw error;
}
export async function createSupport(
  r: Request,
  input: z.infer<typeof supportCreate>,
) {
  const actor = await auth(r, false);
  await limit("support-create:" + actor.user.id, 10, 3600);
  const digest = hash(JSON.stringify(input));
  return db()
    .$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${"support-user:" + actor.user.id},0))`;
      await check(tx, actor, false);
      const old = await tx.supportThread.findUnique({
        where: {
          userId_requestId: {
            userId: actor.user.id,
            requestId: input.requestId,
          },
        },
      });
      if (old) {
        if (old.digest !== digest)
          throw new ApiError(
            409,
            "REQUEST_CONFLICT",
            "شناسهٔ درخواست برای محتوای دیگری استفاده شده است.",
          );
        return threadDto(old);
      }
      await openCapacity(tx, actor.user.id);
      if (
        input.orderId &&
        !(await tx.purchaseOrder.findFirst({
          where: { id: input.orderId, userId: actor.user.id },
        }))
      )
        throw new ApiError(
          404,
          "NOT_FOUND",
          "سفارش متعلق به این حساب پیدا نشد.",
        );
      const thread = await tx.supportThread.create({
        data: {
          userId: actor.user.id,
          orderId: input.orderId,
          requestId: input.requestId,
          digest,
          subject: input.subject,
        },
      });
      await tx.supportMessage.create({
        data: {
          threadId: thread.id,
          authorId: actor.user.id,
          authorKind: "CUSTOMER",
          requestId: input.requestId,
          digest,
          body: input.body,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.user.id,
          action: "support:create",
          resourceId: thread.id,
          data: { orderLinked: !!input.orderId },
        },
      });
      return threadDto(thread);
    })
    .catch(mutationConflict);
}
export async function listSupport(
  r: Request,
  input: z.infer<typeof supportList>,
  admin = false,
) {
  const actor = await auth(r, admin);
  return db().$transaction(async (tx) => {
    await check(tx, actor, admin);
    const rows = await tx.supportThread.findMany({
      where: {
        ...(admin ? {} : { userId: actor.user.id }),
        ...(input.status === "ALL" ? {} : { status: input.status }),
      },
      include: { user: { select: { displayName: true } } },
      orderBy: [{ publicUpdatedAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * 20,
      take: 21,
    });
    return {
      items: rows.slice(0, 20).map((t) => ({
        ...threadDto(t),
        ...(admin ? { customerName: t.user.displayName } : {}),
      })),
      hasMore: rows.length > 20,
      page: input.page,
      ...(admin
        ? {
            canReply: permitted(actor, "support:reply"),
            canNote: permitted(actor, "support:note"),
            canManage: permitted(actor, "support:manage"),
          }
        : {}),
    };
  });
}
export async function readSupport(
  r: Request,
  id: string,
  input: z.infer<typeof supportHistory>,
  admin = false,
) {
  const actor = await auth(r, admin);
  return db().$transaction(async (tx) => {
    await check(tx, actor, admin);
    const thread = await owned(tx, id, actor, admin),
      notes = admin && permitted(actor, "support:note");
    if (notes) await reauthorize(tx, actor, "support:note");
    const base = { threadId: id, ...(notes ? {} : { internal: false }) };
    const cursor = input.before
      ? await tx.supportMessage.findFirst({
          where: { ...base, id: input.before },
        })
      : null;
    if (input.before && !cursor)
      throw new ApiError(404, "NOT_FOUND", "صفحهٔ پیام‌ها پیدا نشد.");
    const messages = await tx.supportMessage.findMany({
      where: {
        ...base,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    return {
      thread: threadDto(thread),
      messages: messages.slice(0, 50).reverse().map(messageDto),
      hasMore: messages.length > 50,
    };
  });
}
export async function sendSupport(
  r: Request,
  id: string,
  input: z.infer<typeof supportMessage>,
  admin = false,
) {
  if (!admin && input.internal)
    throw new ApiError(403, "FORBIDDEN", "ثبت یادداشت داخلی مجاز نیست.");
  const permission = input.internal ? "support:note" : "support:reply",
    actor = await auth(r, admin, permission);
  await limit("support-message:" + actor.user.id, 20, 60);
  const digest = hash(
    JSON.stringify({ id, body: input.body, internal: input.internal }),
  );
  return db()
    .$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SupportThread" WHERE id=${id}::uuid FOR UPDATE`;
      await check(tx, actor, admin, permission);
      const thread = await owned(tx, id, actor, admin);
      const old = await tx.supportMessage.findUnique({
        where: {
          authorId_requestId: {
            authorId: actor.user.id,
            requestId: input.requestId,
          },
        },
      });
      if (old) {
        if (old.threadId !== id || old.digest !== digest)
          throw new ApiError(
            409,
            "REQUEST_CONFLICT",
            "شناسهٔ پیام برای محتوای دیگری استفاده شده است.",
          );
        return messageDto(old);
      }
      if (thread.status === "CLOSED" && !input.internal)
        throw new ApiError(
          409,
          "THREAD_CLOSED",
          "گفت‌وگو بسته است؛ ابتدا آن را دوباره باز کنید.",
        );
      const message = await tx.supportMessage.create({
        data: {
          threadId: id,
          authorId: actor.user.id,
          authorKind: admin ? "STAFF" : "CUSTOMER",
          requestId: input.requestId,
          digest,
          body: input.body,
          internal: input.internal,
        },
      });
      if (!input.internal)
        await tx.supportThread.update({
          where: { id },
          data: {
            version: { increment: 1 },
            publicUpdatedAt: new Date(
              Math.max(Date.now(), thread.publicUpdatedAt.getTime()),
            ),
          },
        });
      await tx.auditLog.create({
        data: {
          actorId: actor.user.id,
          action: input.internal ? "support:note" : "support:message",
          resourceId: id,
          data: { messageId: message.id },
        },
      });
      return messageDto(message);
    })
    .catch(mutationConflict);
}
export async function statusSupport(
  r: Request,
  id: string,
  input: z.infer<typeof supportStatus>,
  admin = false,
) {
  const actor = await auth(r, admin, "support:manage");
  return db().$transaction(async (tx) => {
    // Shared user lock keeps concurrent reopen/create under the customer's open-thread cap.
    if (!admin)
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${"support-user:" + actor.user.id},0))`;
    await tx.$queryRaw`SELECT id FROM "SupportThread" WHERE id=${id}::uuid FOR UPDATE`;
    await check(tx, actor, admin, "support:manage");
    const thread = await owned(tx, id, actor, admin);
    if (thread.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "گفت‌وگو تغییر کرده؛ تازه‌سازی کنید.",
      );
    if (thread.status === input.status) return threadDto(thread);
    if (!admin && input.status === "OPEN")
      await openCapacity(tx, actor.user.id);
    const updated = await tx.supportThread.update({
      where: { id },
      data: {
        status: input.status,
        version: { increment: 1 },
        publicUpdatedAt: new Date(
          Math.max(Date.now(), thread.publicUpdatedAt.getTime()),
        ),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.user.id,
        action: "support:status",
        resourceId: id,
        data: { from: thread.status, to: input.status, reason: input.reason },
      },
    });
    return threadDto(updated);
  });
}
