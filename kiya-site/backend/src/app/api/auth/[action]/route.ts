import {telegramAvailable} from "@/server/settings";
import { z } from "zod";
import { staffIdentifier } from "@/server/identity";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { endpoint, ok, ApiError, readBody, sameOrigin } from "@/server/http";
import {
  session,
  requireUser,
  requireMfaStaff,
  createSession,
  attachCookie,
  safeUser,
  limit,
  clientKey,
  COOKIE,
} from "@/server/auth";
import {
  passwordHash,
  passwordMatches,
  newTotpSecret,
  encrypt,
  decrypt,
  totpStep,
  hash,
} from "@/server/crypto";
export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };
const dummy = passwordHash(
  "Not-a-real-login-" + randomBytes(16).toString("hex"),
);
export async function GET(request: Request, context: Context) {
  return endpoint(async () => {
    const { action } = await context.params;
    if (action !== "me") throw new ApiError(404, "NOT_FOUND", "مسیر پیدا نشد.");
    const current = await session(request);
    return ok({
      user: current ? safeUser(current) : null,
      demoLoginAvailable:
        process.env.APP_MODE === "demo" &&
        process.env.ALLOW_DEMO_LOGIN === "true",
      smsConfigured: false,
      telegramLoginAvailable:await telegramAvailable(),
    });
  });
}
export async function POST(request: Request, context: Context) {
  return endpoint(async () => {
    sameOrigin(request);
    const { action } = await context.params;
    if (action === "demo") {
      if (
        process.env.APP_MODE !== "demo" ||
        process.env.ALLOW_DEMO_LOGIN !== "true"
      )
        throw new ApiError(
          404,
          "NOT_FOUND",
          "این مسیر در محیط واقعی فعال نیست.",
        );
      await readBody(request, z.object({}).strict());
      const existing = await session(request);
      if (existing?.user.kind === "CUSTOMER")
        return ok({ user: safeUser(existing) });
      await limit("demo:" + clientKey(request), 60, 3600);
      const user = await db().$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            kind: "CUSTOMER",
            displayName: "کاربر آزمایشی " + randomBytes(2).toString("hex"),
            isDemo: true,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: u.id,
            action: "auth:demo_created",
            resourceId: u.id,
            data: { isDemo: true },
          },
        });
        return u;
      });
      const created = await createSession(user.id, user.permissionVersion);
      return attachCookie(
        ok(
          {
            user: {
              id: user.id,
              name: user.displayName,
              kind: user.kind,
              isDemo: true,
            },
          },
          201,
        ),
        created.token,
        request,
      );
    }
    if (action === "staff") {
      const input = await readBody(
        request,
        z
          .object({
            handle: z.string().trim().toLowerCase().min(3).max(60),
            password: z.string().min(1).max(200),
          })
          .strict(),
      );
      await limit("staff-global:" + clientKey(request), 20, 900);
      const identifier = staffIdentifier(input.handle);
      await limit("staff:" + identifier.value, 5, 900);
      const user = await db().user.findUnique({
        where: identifier.phone
          ? { phone: identifier.phone }
          : { handle: identifier.handle },
      });
      const matched = passwordMatches(
        input.password,
        user?.passwordHash || dummy,
      );
      if (!user || !matched || user.kind !== "STAFF" || !user.isActive)
        throw new ApiError(401, "INVALID_LOGIN", "اطلاعات ورود معتبر نیست.");
      const created = await createSession(user.id, user.permissionVersion);
      await db().auditLog.create({
        data: {
          actorId: user.id,
          action: "auth:password_verified",
          resourceId: created.record.id,
          data: { mfaPending: true },
        },
      });
      return attachCookie(
        ok({ mfaEnabled: user.mfaEnabled, mfaRequired: true }),
        created.token,
        request,
      );
    }
    if (action === "logout") {
      await readBody(request, z.object({}).strict());
      const current = await session(request);
      if (current)
        await db().$transaction(async (tx) => {
          await tx.session.update({
            where: { id: current.id },
            data: { revokedAt: new Date() },
          });
          await tx.auditLog.create({
            data: {
              actorId: current.user.id,
              action: "auth:logout",
              resourceId: current.id,
              data: {},
            },
          });
        });
      const response = ok({ loggedOut: true });
      response.cookies.set(COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    if (action === "mfa-setup") {
      await readBody(request, z.object({}).strict());
      const current = await requireUser(request);
      if (current.user.kind !== "STAFF")
        throw new ApiError(403, "FORBIDDEN", "اجازهٔ این کار را ندارید.");
      await limit("mfa-setup:" + current.user.id, 3, 600);
      const secret = newTotpSecret();
      await db().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${current.user.id}::uuid FOR UPDATE`;
        const u = await tx.user.findUniqueOrThrow({
          where: { id: current.user.id },
        });
        if (!u.isActive || u.permissionVersion !== current.permissionVersion)
          throw new ApiError(
            401,
            "SESSION_REVOKED",
            "نشست معتبر نیست؛ دوباره وارد شوید.",
          );
        if (u.mfaEnabled)
          throw new ApiError(
            409,
            "MFA_ALREADY_ENABLED",
            "تأیید دومرحله‌ای قبلاً فعال شده است.",
          );
        await tx.user.update({
          where: { id: u.id },
          data: { mfaSecret: encrypt(secret) },
        });
        await tx.auditLog.create({
          data: {
            actorId: u.id,
            action: "auth:mfa_setup_started",
            resourceId: u.id,
            data: {},
          },
        });
      });
      return ok({
        secret,
        uri: `otpauth://totp/KIYA:${encodeURIComponent(current.user.handle || "staff")}?secret=${secret}&issuer=KIYA&algorithm=SHA1&digits=6&period=30`,
      });
    }
    if (action === "mfa-verify") {
      const { code } = await readBody(
        request,
        z
          .object({
            code: z
              .string()
              .trim()
              .regex(/^(\d{6}|[a-f0-9]{32})$/i),
          })
          .strict(),
      );
      const current = await requireUser(request);
      if (current.user.kind !== "STAFF")
        throw new ApiError(403, "FORBIDDEN", "ورود پرسنل لازم است.");
      await limit("mfa:" + current.user.id, 5, 60);
      const recoveryCodes = await db().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${current.user.id}::uuid FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({
          where: { id: current.user.id },
        });
        const activeSession = await tx.session.findUnique({
          where: { id: current.id },
        });
        if (
          !user.isActive ||
          user.permissionVersion !== current.permissionVersion ||
          !activeSession ||
          activeSession.revokedAt ||
          activeSession.expiresAt < new Date()
        )
          throw new ApiError(
            401,
            "SESSION_REVOKED",
            "نشست معتبر نیست؛ دوباره وارد شوید.",
          );
        if (!user.mfaSecret)
          throw new ApiError(
            409,
            "MFA_SETUP_REQUIRED",
            "ابتدا تنظیم تأیید دومرحله‌ای را انجام دهید.",
          );
        const step = totpStep(decrypt(user.mfaSecret), code);
        let recoveryUsed = false;
        if (step === null && user.mfaEnabled && /^[a-f0-9]{32}$/i.test(code)) {
          const used = await tx.recoveryCode.updateMany({
            where: {
              userId: user.id,
              codeHash: hash(code.toLowerCase()),
              consumedAt: null,
            },
            data: { consumedAt: new Date() },
          });
          recoveryUsed = used.count === 1;
        }
        if (
          !recoveryUsed &&
          (step === null ||
            (user.mfaLastStep !== null && step <= user.mfaLastStep))
        )
          throw new ApiError(
            401,
            "INVALID_MFA",
            "کد معتبر نیست یا قبلاً استفاده شده است.",
          );
        const backups = user.mfaEnabled
          ? []
          : Array.from({ length: 8 }, () => randomBytes(16).toString("hex"));
        if (backups.length)
          await tx.recoveryCode.createMany({
            data: backups.map((value) => ({
              userId: user.id,
              codeHash: hash(value),
            })),
          });
        await tx.user.update({
          where: { id: user.id },
          data: {
            mfaEnabled: true,
            ...(step !== null ? { mfaLastStep: step } : {}),
          },
        });
        await tx.session.update({
          where: { id: current.id },
          data: { mfaVerified: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "auth:mfa_verified",
            resourceId: current.id,
            data: { recoveryUsed },
          },
        });
        return backups;
      });
      return ok({ verified: true, recoveryCodes });
    }
    if (action === "password") {
      const input = await readBody(
        request,
        z
          .object({
            oldPassword: z.string().min(1).max(200),
            newPassword: z.string().min(14).max(200),
          })
          .strict(),
      );
      const current = await requireMfaStaff(request);
      await limit("password:" + current.user.id, 5, 900);
      if (input.oldPassword === input.newPassword)
        throw new ApiError(422, "SAME_PASSWORD", "رمز جدید باید متفاوت باشد.");
      await db().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${current.user.id}::uuid FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({
          where: { id: current.user.id },
        });
        const active = await tx.session.findUnique({
          where: { id: current.id },
        });
        if (
          !user.isActive ||
          !user.mfaEnabled ||
          user.permissionVersion !== current.permissionVersion ||
          !active ||
          active.revokedAt ||
          active.expiresAt < new Date()
        )
          throw new ApiError(401, "SESSION_REVOKED", "نشست معتبر نیست.");
        if (
          !user.passwordHash ||
          !passwordMatches(input.oldPassword, user.passwordHash)
        )
          throw new ApiError(401, "INVALID_PASSWORD", "رمز فعلی معتبر نیست.");
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: passwordHash(input.newPassword),
            permissionVersion: { increment: 1 },
          },
        });
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "auth:password_changed",
            resourceId: user.id,
            data: { allSessionsRevoked: true },
          },
        });
      });
      const response = ok({ changed: true, loginRequired: true });
      response.cookies.set(COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    if (action === "otp-request")
      throw new ApiError(
        503,
        "SMS_UNCONFIGURED",
        "سرویس پیامک هنوز تنظیم نشده است؛ هیچ کدی ارسال نشد.",
      );
    throw new ApiError(404, "NOT_FOUND", "مسیر پیدا نشد.");
  });
}
