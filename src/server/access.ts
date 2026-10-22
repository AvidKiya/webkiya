import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { PERMISSIONS, requireStaff, limit, type AuthSession } from "./auth";
import { ApiError } from "./http";
import { passwordHash } from "./crypto";
import { normalizePhone } from "./identity";
const delegated = PERMISSIONS.filter(
  (p) => !["staff:manage", "role:manage"].includes(p),
);
export const roleInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    permissions: z
      .array(z.enum(PERMISSIONS))
      .min(1)
      .max(PERMISSIONS.length)
      .refine((p) => p.every((value) => delegated.includes(value))),
  })
  .strict();
export const editRoleInput = roleInput
  .extend({ version: z.number().int().positive() })
  .strict();
export const staffInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z0-9_-]{2,39}$/),
    phone: z
      .string()
      .trim()
      .max(20)
      .optional()
      .refine((v) => !v || !!normalizePhone(v)),
    password: z.string().min(14).max(200),
    roleIds: z.array(z.uuid()).min(1).max(5),
    ownerConfirmed: z.boolean().default(false),
  })
  .strict();
export const editStaffInput = z
  .object({
    isActive: z.boolean(),
    roleIds: z.array(z.uuid()).min(1).max(5),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
    ownerConfirmed: z.boolean().default(false),
  })
  .strict();
export async function requireOwner(
  request: Request,
  permission: "staff:manage" | "role:manage" = "staff:manage",
) {
  const actor = await requireStaff(request, permission);
  if (!actor.user.roles.some((r) => r.role.key === "OWNER"))
    throw new ApiError(
      403,
      "OWNER_REQUIRED",
      "این عملیات فقط برای مدیر کل مجاز است.",
    );
  return actor;
}
// One lock serializes role edits and staff transitions, including opposite-owner races.
type Tx = Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0];
async function lockAndAuthorize(tx: Tx, actor: AuthSession) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(27102028)`;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${actor.user.id}::uuid FOR UPDATE`;
  const activeSession = await tx.session.findUnique({
    where: { id: actor.id },
  });
  const fresh = await tx.user.findUnique({
    where: { id: actor.user.id },
    include: { roles: { include: { role: true } } },
  });
  if (
    !activeSession ||
    activeSession.revokedAt ||
    !activeSession.mfaVerified ||
    activeSession.expiresAt < new Date() ||
    !fresh?.isActive ||
    !fresh.mfaEnabled ||
    fresh.kind !== "STAFF" ||
    fresh.permissionVersion !== actor.permissionVersion ||
    !fresh.roles.some((r) => r.role.key === "OWNER")
  )
    throw new ApiError(
      401,
      "SESSION_REVOKED",
      "دسترسی تغییر کرده است؛ دوباره وارد شوید.",
    );
}
// Prisma interactive transaction client omits connection/lifecycle methods.
async function authorize(tx: Tx, actor: AuthSession) {
  return lockAndAuthorize(tx, actor);
}
async function rolesFor(tx: Tx, ids: string[], confirmed: boolean) {
  const unique = [...new Set(ids)];
  const roles = await tx.role.findMany({ where: { id: { in: unique } } });
  if (roles.length !== unique.length)
    throw new ApiError(422, "INVALID_ROLES", "نقش انتخاب‌شده معتبر نیست.");
  if (roles.some((r) => r.key === "OWNER") && !confirmed)
    throw new ApiError(
      422,
      "OWNER_CONFIRMATION",
      "اعطای دسترسی مدیر کل نیاز به تأیید صریح دارد.",
    );
  return roles;
}
export async function accessData(request: Request) {
  await requireOwner(request);
  const [staff, roles] = await Promise.all([
    db().user.findMany({
      where: { kind: "STAFF" },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        displayName: true,
        handle: true,
        phone: true,
        isDemo: true,
        isActive: true,
        mfaEnabled: true,
        permissionVersion: true,
        roles: { select: { roleId: true } },
      },
    }),
    db().role.findMany({
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        permissions: true,
        version: true,
      },
    }),
  ]);
  return {
    staff: staff.map(({ phone, ...s }) => ({
      ...s,
      phoneMasked: phone ? phone.slice(0, 5) + "••••" + phone.slice(-3) : null,
    })),
    roles,
    delegatedPermissions: delegated,
  };
}
export async function createRole(
  request: Request,
  input: z.infer<typeof roleInput>,
) {
  const actor = await requireOwner(request, "role:manage");
  await limit("iam:" + actor.user.id, 20, 60);
  return db().$transaction(async (tx) => {
    await authorize(tx, actor);
    const role = await tx.role.create({
      data: {
        key: "CUSTOM_" + randomUUID().slice(0, 8),
        name: input.name,
        permissions: [...new Set(input.permissions)],
      },
      select: {
        id: true,
        name: true,
        key: true,
        permissions: true,
        version: true,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.user.id,
        action: "role:create",
        resourceId: role.id,
        data: { permissions: role.permissions },
      },
    });
    return role;
  });
}
export async function editRole(
  request: Request,
  id: string,
  input: z.infer<typeof editRoleInput>,
) {
  const actor = await requireOwner(request, "role:manage");
  await limit("iam:" + actor.user.id, 20, 60);
  return db().$transaction(async (tx) => {
    await authorize(tx, actor);
    const role = await tx.role.findUnique({ where: { id } });
    if (!role) throw new ApiError(404, "NOT_FOUND", "نقش پیدا نشد.");
    if (!role.key.startsWith("CUSTOM_"))
      throw new ApiError(
        403,
        "BUILTIN_ROLE",
        "نقش‌های پایه از این مسیر تغییر نمی‌کنند.",
      );
    if (role.version !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "نقش تغییر کرده؛ تازه‌سازی کنید.",
      );
    const assignments = await tx.userRole.findMany({
      where: { roleId: id },
      select: { userId: true },
    });
    const ids = assignments.map((a) => a.userId);
    const updated = await tx.role.update({
      where: { id },
      data: {
        name: input.name,
        permissions: [...new Set(input.permissions)],
        version: { increment: 1 },
      },
    });
    if (ids.length) {
      await tx.user.updateMany({
        where: { id: { in: ids } },
        data: { permissionVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId: { in: ids }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.user.id,
        action: "role:update",
        resourceId: id,
        data: {
          version: updated.version,
          permissions: updated.permissions,
          revokedUsers: ids.length,
        },
      },
    });
    return updated;
  });
}
export async function createStaff(
  request: Request,
  input: z.infer<typeof staffInput>,
) {
  const actor = await requireOwner(request);
  await limit("iam:" + actor.user.id, 20, 60);
  const encoded = passwordHash(input.password),
    phone = input.phone ? normalizePhone(input.phone) : null;
  return db().$transaction(async (tx) => {
    await authorize(tx, actor);
    const roles = await rolesFor(tx, input.roleIds, input.ownerConfirmed);
    const exists = await tx.user.findFirst({
      where: { OR: [{ handle: input.handle }, ...(phone ? [{ phone }] : [])] },
      select: { id: true },
    });
    if (exists)
      throw new ApiError(
        409,
        "ALREADY_EXISTS",
        "شناسه یا شماره قبلاً ثبت شده است.",
      );
    const u = await tx.user.create({
      data: {
        kind: "STAFF",
        displayName: input.name,
        handle: input.handle,
        phone,
        passwordHash: encoded,
        isDemo: false,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      select: {
        id: true,
        displayName: true,
        isActive: true,
        mfaEnabled: true,
        permissionVersion: true,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.user.id,
        action: "staff:create",
        resourceId: u.id,
        data: { roles: roles.map((r) => r.key), mfaRequired: true },
      },
    });
    return u;
  });
}
export async function editStaff(
  request: Request,
  id: string,
  input: z.infer<typeof editStaffInput>,
) {
  const actor = await requireOwner(request);
  await limit("iam:" + actor.user.id, 20, 60);
  return db().$transaction(async (tx) => {
    await authorize(tx, actor);
    const target = await tx.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!target || target.kind !== "STAFF")
      throw new ApiError(404, "NOT_FOUND", "پرسنل پیدا نشد.");
    if (target.permissionVersion !== input.version)
      throw new ApiError(
        409,
        "STALE_VERSION",
        "حساب تغییر کرده؛ تازه‌سازی کنید.",
      );
    const roles = await rolesFor(tx, input.roleIds, input.ownerConfirmed);
    const wasOwner =
      target.isActive && target.roles.some((r) => r.role.key === "OWNER");
    const remainsOwner = input.isActive && roles.some((r) => r.key === "OWNER");
    if (wasOwner && !remainsOwner) {
      const count = await tx.user.count({
        where: {
          kind: "STAFF",
          isActive: true,
          roles: { some: { role: { key: "OWNER" } } },
        },
      });
      if (count <= 1)
        throw new ApiError(
          409,
          "LAST_OWNER",
          "آخرین مدیر کل فعال را نمی‌توان حذف یا غیرفعال کرد.",
        );
    }
    if (id === actor.user.id)
      throw new ApiError(
        403,
        "SELF_MANAGEMENT",
        "تغییر نقش یا وضعیت حساب خودتان از این مسیر مجاز نیست.",
      );
    await tx.userRole.deleteMany({ where: { userId: id } });
    await tx.userRole.createMany({
      data: roles.map((r) => ({ userId: id, roleId: r.id })),
    });
    const u = await tx.user.update({
      where: { id },
      data: { isActive: input.isActive, permissionVersion: { increment: 1 } },
      select: { id: true, isActive: true, permissionVersion: true },
    });
    await tx.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.user.id,
        action: "staff:update",
        resourceId: id,
        data: {
          isActive: u.isActive,
          roles: roles.map((r) => r.key),
          version: u.permissionVersion,
          reason: input.reason,
        },
      },
    });
    return u;
  });
}
