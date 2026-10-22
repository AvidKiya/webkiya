import "server-only";
import { randomBytes, createHmac } from "node:crypto";
import { db } from "./db";
import { hash } from "./crypto";
import { ApiError } from "./http";
import type { NextResponse } from "next/server";
export const COOKIE = "kiya_session";
export const PERMISSIONS = [
  "dashboard:read",
  "comment:read",
  "comment:reply",
  "comment:moderate",
  "partner:read",
  "partner:review",
  "partner:approve",
  "partner:suspend",
  "product:read",
  "product:write",
  "staff:read",
  "staff:manage",
  "role:manage",
  "audit:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export async function limit(key: string, max: number, seconds: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new ApiError(
      503,
      "AUTH_UNCONFIGURED",
      "ورود هنوز پیکربندی نشده است.",
    );
  const safe = createHmac("sha256", secret).update(key).digest("hex");
  const window = Math.floor(Date.now() / (seconds * 1000));
  const [row] = await db().$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateBucket" ("key","count","expiresAt") VALUES (${safe + ":" + window},1,${new Date((window + 1) * seconds * 1000)}) ON CONFLICT ("key") DO UPDATE SET "count"="RateBucket"."count"+1 RETURNING "count"`;
  if (row.count > max)
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "تعداد تلاش‌ها زیاد است. کمی بعد دوباره امتحان کنید.",
    );
}
export function clientKey(request: Request) {
  return process.env.TRUST_PROXY === "true"
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local-untrusted-proxy";
}
export async function session(request: Request) {
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const current = await db().session.findUnique({
    where: { tokenHash: hash(raw) },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (
    !current ||
    (current.user.isDemo && process.env.APP_MODE !== "demo") ||
    current.revokedAt ||
    current.expiresAt < new Date() ||
    !current.user.isActive ||
    current.permissionVersion !== current.user.permissionVersion
  )
    return null;
  return current;
}
export type AuthSession = NonNullable<Awaited<ReturnType<typeof session>>>;
export async function requireUser(request: Request) {
  const current = await session(request);
  if (!current)
    throw new ApiError(401, "AUTH_REQUIRED", "اول وارد حساب خودت شو.");
  return current;
}
export function permissions(current: AuthSession): string[] {
  return [...new Set(current.user.roles.flatMap((r) => r.role.permissions))];
}
export async function requireMfaStaff(request: Request) {
  const current = await requireUser(request);
  if (
    current.user.kind !== "STAFF" ||
    !current.user.mfaEnabled ||
    !current.mfaVerified
  )
    throw new ApiError(
      403,
      "MFA_REQUIRED",
      "ورود پرسنل و تأیید دومرحله‌ای لازم است.",
    );
  return current;
}
export async function requireStaff(request: Request, permission: Permission) {
  const current = await requireMfaStaff(request);
  if (!permissions(current).includes(permission))
    throw new ApiError(403, "FORBIDDEN", "اجازهٔ انجام این کار را ندارید.");
  return current;
}
export async function createSession(
  userId: string,
  version: number,
  mfaVerified = false,
) {
  const token = randomBytes(32).toString("hex");
  const record = await db().session.create({
    data: {
      userId,
      permissionVersion: version,
      tokenHash: hash(token),
      mfaVerified,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });
  return { token, record };
}
export function attachCookie(
  response: NextResponse,
  token: string,
  request: Request,
) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      (process.env.APP_MODE !== "demo" &&
        process.env.NODE_ENV === "production") ||
      new URL(request.url).protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
export function safeUser(current: AuthSession) {
  return {
    id: current.user.id,
    name: current.user.displayName,
    kind: current.user.kind,
    isDemo: current.user.isDemo,
    mfaEnabled: current.user.mfaEnabled,
    mfaVerified: current.mfaVerified,
    permissions: current.mfaVerified ? permissions(current) : [],
  };
}
