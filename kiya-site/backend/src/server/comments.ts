import "server-only";
import { db } from "./db";
import { ApiError } from "./http";
import { requireUser, requireStaff, limit, type AuthSession } from "./auth";
import { z } from "zod";
export const commentInput = z
  .object({
    body: z
      .string()
      .trim()
      .min(1)
      .max(1500)
      .refine((s) => (s.match(/https?:\/\//gi) || []).length <= 1),
    parentId: z.uuid().optional(),
    clientMutationId: z.uuid(),
  })
  .strict();
export type CommentInput = z.infer<typeof commentInput>;
const authorSelect = {
  id: true,
  displayName: true,
  kind: true,
  isDemo: true,
} as const;
function dto(
  c: {
    id: string;
    postId: string;
    userId: string;
    body: string;
    parentId: string | null;
    status: string;
    createdAt: Date;
    author: { id: string; displayName: string; kind: string; isDemo: boolean };
  },
  current: AuthSession | null,
) {
  return {
    id: c.id,
    postId: c.postId,
    name: c.author.displayName,
    text:
      c.status === "DELETED" ? "این دیدگاه توسط نویسنده حذف شده است." : c.body,
    parentId: c.parentId,
    createdAt: c.createdAt.toISOString(),
    isDemo: c.author.isDemo,
    isOfficial: c.author.kind === "STAFF",
    canDelete: current?.user.id === c.userId && c.status === "VISIBLE",
    status: c.status,
  };
}
export async function listComments(
  postId: string,
  current: AuthSession | null,
  cursor?: string,
) {
  const product = await db().product.findFirst({
    where: { id: postId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!product) throw new ApiError(404, "NOT_FOUND", "پست پیدا نشد.");
  if (cursor) {
    const anchor = await db().comment.findFirst({
      where: { id: cursor, postId, parentId: null },
    });
    if (!anchor)
      throw new ApiError(
        422,
        "INVALID_CURSOR",
        "صفحه‌بندی متعلق به این پست نیست.",
      );
  }
  const eligible = {
    postId,
    status: { in: ["VISIBLE", "DELETED"] },
    ...(process.env.APP_MODE !== "demo" ? { author: { isDemo: false } } : {}),
    OR: [
      { parentId: null },
      {
        parent: {
          status: { in: ["VISIBLE", "DELETED"] },
          ...(process.env.APP_MODE !== "demo"
            ? { author: { isDemo: false } }
            : {}),
        },
      },
    ],
  };
  // Stable insertion order with an opaque root cursor; bounded page including replies.
  const roots = await db().comment.findMany({
    where: { ...eligible, parentId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      author: { select: authorSelect },
      replies: {
        where: {
          status: { in: ["VISIBLE", "DELETED"] },
          ...(process.env.APP_MODE !== "demo"
            ? { author: { isDemo: false } }
            : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 21,
        include: { author: { select: authorSelect } },
      },
    },
  });
  const page = roots.slice(0, 20);
  const count = await db().comment.count({
    where: { ...eligible, status: "VISIBLE" },
  });
  return {
    items: page.flatMap((root) => [
      {
        ...dto(root, current),
        replyCursor: root.replies.length > 20 ? root.replies[19].id : null,
      },
      ...root.replies.slice(0, 20).map((c) => dto(c, current)),
    ]),
    count,
    nextCursor: roots.length > 20 ? page[page.length - 1].id : null,
  };
}
export async function createComment(
  request: Request,
  postId: string,
  input: CommentInput,
) {
  const current = await requireUser(request);
  if (current.user.kind === "STAFF")
    await requireStaff(request, "comment:reply");
  if (
    current.user.kind === "CUSTOMER" &&
    !current.user.phoneVerifiedAt &&
    !(current.user.isDemo && process.env.APP_MODE === "demo")
  )
    throw new ApiError(403, "PHONE_REQUIRED", "تأیید شمارهٔ موبایل لازم است.");
  const prior = await db().comment.findUnique({
    where: {
      userId_clientMutationId: {
        userId: current.user.id,
        clientMutationId: input.clientMutationId,
      },
    },
    include: { author: { select: authorSelect } },
  });
  if (prior) {
    if (
      prior.postId !== postId ||
      prior.body !== input.body ||
      prior.parentId !== (input.parentId || null)
    )
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "کلید تکرار متعلق به دیدگاه دیگری است.",
      );
    return dto(prior, current);
  }
  await limit("comment:" + current.user.id, 5, 60);
  const result = await db().$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: postId, status: "PUBLISHED" },
    });
    if (!product) throw new ApiError(404, "NOT_FOUND", "پست پیدا نشد.");
    if (input.parentId) {
      const parent = await tx.comment.findUnique({
        where: { id: input.parentId },
      });
      if (
        !parent ||
        parent.postId !== postId ||
        parent.parentId ||
        parent.status !== "VISIBLE"
      )
        throw new ApiError(
          422,
          "INVALID_PARENT",
          "پاسخ باید به دیدگاه اصلی همین پست باشد.",
        );
    }
    // Serializes retries from this author before rechecking the unique mutation key.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${current.user.id}::uuid FOR UPDATE`;
    const existing = await tx.comment.findUnique({
      where: {
        userId_clientMutationId: {
          userId: current.user.id,
          clientMutationId: input.clientMutationId,
        },
      },
      include: { author: { select: authorSelect } },
    });
    if (existing) {
      if (
        existing.postId !== postId ||
        existing.body !== input.body ||
        existing.parentId !== (input.parentId || null)
      )
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "درخواست تکراری متفاوت است.",
        );
      return existing;
    }
    const comment = await tx.comment.create({
      data: {
        postId,
        userId: current.user.id,
        body: input.body,
        parentId: input.parentId,
        clientMutationId: input.clientMutationId,
      },
      include: { author: { select: authorSelect } },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "comment:create",
        resourceId: comment.id,
        data: { postId, isDemo: current.user.isDemo },
      },
    });
    return comment;
  });
  return dto(result, current);
}
export async function removeComment(request: Request, id: string) {
  const current = await requireUser(request);
  await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Comment" WHERE "id"=${id}::uuid FOR UPDATE`;
    const c = await tx.comment.findUnique({ where: { id } });
    if (!c || c.userId !== current.user.id)
      throw new ApiError(404, "NOT_FOUND", "دیدگاه پیدا نشد.");
    if (c.status === "DELETED") return;
    await tx.comment.update({
      where: { id },
      data: { status: "DELETED", body: "[deleted]" },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "comment:delete",
        resourceId: id,
        data: { postId: c.postId },
      },
    });
  });
  return { deleted: true };
}

export async function listReplies(
  postId: string,
  rootId: string,
  current: AuthSession | null,
  cursor?: string,
) {
  const root = await db().comment.findFirst({
    where: {
      id: rootId,
      postId,
      parentId: null,
      status: { in: ["VISIBLE", "DELETED"] },
      post: { status: "PUBLISHED" },
      ...(process.env.APP_MODE !== "demo" ? { author: { isDemo: false } } : {}),
    },
  });
  if (!root) throw new ApiError(404, "NOT_FOUND", "دیدگاه پیدا نشد.");
  if (
    cursor &&
    !(await db().comment.findFirst({
      where: { id: cursor, parentId: rootId, postId },
    }))
  )
    throw new ApiError(422, "INVALID_CURSOR", "صفحه‌بندی معتبر نیست.");
  const records = await db().comment.findMany({
    where: {
      postId,
      parentId: rootId,
      status: { in: ["VISIBLE", "DELETED"] },
      ...(process.env.APP_MODE !== "demo" ? { author: { isDemo: false } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { author: { select: authorSelect } },
  });
  return {
    items: records.slice(0, 20).map((c) => dto(c, current)),
    nextCursor: records.length > 20 ? records[19].id : null,
  };
}
