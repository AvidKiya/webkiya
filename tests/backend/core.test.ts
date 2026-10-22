import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { db } from "@/server/db";
import { createSession, COOKIE, session } from "@/server/auth";
import {
  passwordHash,
  passwordMatches,
  totp,
  decrypt,
  hash,
} from "@/server/crypto";
import { GET as me, POST as auth } from "@/app/api/auth/[action]/route";
import { GET as list, POST as post } from "@/app/api/posts/[id]/comments/route";
import { DELETE as remove } from "@/app/api/comments/[id]/route";
import { GET as admin } from "@/app/api/admin/[module]/route";
import { PATCH as moderate } from "@/app/api/admin/comments/[id]/route";
import { POST as apply, GET as partnerMe } from "@/app/api/partner/route";
import { PATCH as review } from "@/app/api/admin/partners/[id]/route";
const origin = "http://kiya.test";
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const acontext = (action: string) => ({ params: Promise.resolve({ action }) });
function request(
  path: string,
  method = "GET",
  cookie = "",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(origin + path, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function payload(response: Response) {
  return response.json();
}
function cookie(response: Response) {
  return (response.headers.get("set-cookie") || "").split(";")[0];
}
async function customer() {
  const response = await auth(
    request("/api/auth/demo", "POST", "", {}),
    acontext("demo"),
  );
  expect(response.status).toBe(201);
  const p = await payload(response);
  return { cookie: cookie(response), id: p.data.user.id };
}
async function staff(role = "OWNER", verified = true) {
  const handle = "test_" + randomUUID().slice(0, 8);
  const password = "temporary-test-" + randomUUID();
  const user = await db().user.create({
    data: {
      displayName: "پرسنل آزمون",
      handle,
      kind: "STAFF",
      passwordHash: passwordHash(password),
      mfaEnabled: verified,
      roles: { create: { role: { connect: { key: role } } } },
    },
  });
  const s = await createSession(user.id, user.permissionVersion, verified);
  return { user, password, cookie: COOKIE + "=" + s.token, session: s.record };
}
async function add(
  c: string,
  body = "دیدگاه آزمون",
  parentId?: string,
  postId = "everyday-bag",
  clientMutationId = randomUUID(),
) {
  return post(
    request("/api/posts/" + postId + "/comments", "POST", c, {
      body,
      parentId,
      clientMutationId,
    }),
    context(postId),
  );
}
beforeEach(async () => {
  await db().$executeRawUnsafe(
    'TRUNCATE "UserRole","Session","RecoveryCode","Comment","PartnerAccount","AuditLog","RateBucket","User" CASCADE',
  );
});
afterAll(async () => {
  await db().$disconnect();
});
describe("real PostgreSQL backend", () => {
  it("runs on PostgreSQL and keeps migrated constraints", async () => {
    const [version] = await db().$queryRaw<
      { version: string }[]
    >`SELECT version()`;
    expect(version.version).toContain("PostgreSQL");
    expect(await db().role.count()).toBe(3);
    expect(await db().product.count()).toBe(5);
  });
  it("does not accept anonymous comments or a cross-origin mutation", async () => {
    expect((await add("")).status).toBe(401);
    const response = await auth(
      request(
        "/api/auth/demo",
        "POST",
        "",
        {},
        { Origin: "https://evil.example" },
      ),
      acontext("demo"),
    );
    expect(response.status).toBe(403);
    expect(await db().user.count()).toBe(0);
  });
  it("keeps development login separate and never takes a client-selected role", async () => {
    expect(
      (
        await auth(
          request("/api/auth/demo", "POST", "", {
            kind: "STAFF",
            roles: ["OWNER"],
          }),
          acontext("demo"),
        )
      ).status,
    ).toBe(422);
    process.env.APP_MODE = "live";
    try {
      expect(
        (
          await auth(
            request("/api/auth/demo", "POST", "", {}),
            acontext("demo"),
          )
        ).status,
      ).toBe(404);
    } finally {
      process.env.APP_MODE = "demo";
    }
    const c = await customer();
    const u = await db().user.findUniqueOrThrow({ where: { id: c.id } });
    expect(u.kind).toBe("CUSTOMER");
    expect(u.phoneVerifiedAt).toBeNull();
    expect(u.isDemo).toBe(true);
  });
  it("shares comments and replies across independent sessions, preserving exact text", async () => {
    const a = await customer(),
      b = await customer();
    const text = "<img src=x onerror=alert(1)> متن عمومی";
    const root = await payload(await add(a.cookie, text));
    expect(root.ok).toBe(true);
    expect((await add(b.cookie, "پاسخ عمومی", root.data.id)).status).toBe(201);
    const result = await payload(
      await list(
        request("/api/posts/everyday-bag/comments", "GET", b.cookie),
        context("everyday-bag"),
      ),
    );
    expect(result.data.count).toBe(2);
    expect(result.data.items[0].text).toBe(text);
    expect(result.data.items[0].canDelete).toBe(false);
    expect(result.data.items[1].parentId).toBe(root.data.id);
  });
  it("makes concurrent comment retries idempotent and rejects mutation-key collisions", async () => {
    const c = await customer(),
      key = randomUUID();
    const [one, two] = await Promise.all([
      add(c.cookie, "تکرار امن", undefined, "everyday-bag", key),
      add(c.cookie, "تکرار امن", undefined, "everyday-bag", key),
    ]);
    expect(one.status).toBe(201);
    expect(two.status).toBe(201);
    expect((await payload(one)).data.id).toBe((await payload(two)).data.id);
    expect(await db().comment.count()).toBe(1);
    expect(
      (await add(c.cookie, "متن دیگر", undefined, "everyday-bag", key)).status,
    ).toBe(409);
  });
  it("rejects cross-post and nested replies in service and database constraints", async () => {
    const c = await customer();
    const root = (await payload(await add(c.cookie))).data;
    expect(
      (await add(c.cookie, "پاسخ به پست دیگر", root.id, "minimal-watch"))
        .status,
    ).toBe(422);
    const reply = (await payload(await add(c.cookie, "پاسخ یک سطحی", root.id)))
      .data;
    expect((await add(c.cookie, "پاسخ تو در تو", reply.id)).status).toBe(422);
    await expect(
      db().comment.create({
        data: {
          postId: "minimal-watch",
          userId: c.id,
          parentId: root.id,
          body: "Invalid direct insert",
          clientMutationId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
  });
  it("enforces comment ownership and preserves reply tombstones on deletion", async () => {
    const a = await customer(),
      b = await customer();
    const root = (await payload(await add(a.cookie))).data;
    await add(b.cookie, "پاسخ باقی می‌ماند", root.id);
    expect(
      (
        await remove(
          request("/api/comments/" + root.id, "DELETE", b.cookie),
          context(root.id),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await remove(
          request("/api/comments/" + root.id, "DELETE", a.cookie),
          context(root.id),
        )
      ).status,
    ).toBe(200);
    const result = (
      await payload(
        await list(
          request("/api/posts/everyday-bag/comments"),
          context("everyday-bag"),
        ),
      )
    ).data;
    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe("DELETED");
    expect(result.items[0].text).not.toBe("دیدگاه آزمون");
  });
  it("hides moderated roots and their replies, with an append-only audit trail", async () => {
    const c = await customer(),
      s = await staff();
    const root = (await payload(await add(c.cookie))).data;
    await add(c.cookie, "پاسخ نمونه", root.id);
    const response = await moderate(
      request("/api/admin/comments/" + root.id, "PATCH", s.cookie, {
        status: "HIDDEN",
        reason: "بررسی محتوای نامناسب",
      }),
      context(root.id),
    );
    expect(response.status).toBe(200);
    const result = (
      await payload(
        await list(
          request("/api/posts/everyday-bag/comments"),
          context("everyday-bag"),
        ),
      )
    ).data;
    expect(result.items).toHaveLength(0);
    expect(result.count).toBe(0);
    const audit = await db().auditLog.findFirstOrThrow({
      where: { action: "comment:moderate" },
    });
    await expect(
      db().auditLog.update({
        where: { id: audit.id },
        data: { action: "tampered" },
      }),
    ).rejects.toThrow();
    await expect(
      db().auditLog.delete({ where: { id: audit.id } }),
    ).rejects.toThrow();
  });
  it("requires MFA before any staff data and omits secrets from all viewer DTOs", async () => {
    const s = await staff("OWNER", false);
    const response = await admin(
      request("/api/admin/dashboard", "GET", s.cookie),
      { params: Promise.resolve({ module: "dashboard" }) },
    );
    expect(response.status).toBe(403);
    const result = await payload(
      await me(request("/api/auth/me", "GET", s.cookie), acontext("me")),
    );
    expect(result.data.user.permissions).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(
      /passwordHash|mfaSecret|tokenHash/,
    );
  });
  it("enrolls encrypted TOTP, refuses replay, and consumes recovery codes exactly once", async () => {
    const s = await staff("OWNER", false);
    const setup = await payload(
      await auth(
        request("/api/auth/mfa-setup", "POST", s.cookie, {}),
        acontext("mfa-setup"),
      ),
    );
    expect(setup.ok).toBe(true);
    const user = await db().user.findUniqueOrThrow({
      where: { id: s.user.id },
    });
    expect(user.mfaSecret).not.toContain(setup.data.secret);
    expect(decrypt(user.mfaSecret!)).toBe(setup.data.secret);
    const code = totp(setup.data.secret);
    const verified = await payload(
      await auth(
        request("/api/auth/mfa-verify", "POST", s.cookie, { code }),
        acontext("mfa-verify"),
      ),
    );
    expect(verified.data.recoveryCodes).toHaveLength(8);
    expect(
      (
        await admin(request("/api/admin/dashboard", "GET", s.cookie), {
          params: Promise.resolve({ module: "dashboard" }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await auth(
          request("/api/auth/mfa-verify", "POST", s.cookie, { code }),
          acontext("mfa-verify"),
        )
      ).status,
    ).toBe(401);
    const backup = verified.data.recoveryCodes[0];
    expect(
      await db().recoveryCode.findUnique({ where: { codeHash: hash(backup) } }),
    ).not.toBeNull();
    expect(
      (
        await auth(
          request("/api/auth/mfa-verify", "POST", s.cookie, { code: backup }),
          acontext("mfa-verify"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await auth(
          request("/api/auth/mfa-verify", "POST", s.cookie, { code: backup }),
          acontext("mfa-verify"),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await auth(
          request("/api/auth/mfa-setup", "POST", s.cookie, {}),
          acontext("mfa-setup"),
        )
      ).status,
    ).toBe(409);
  });
  it("does not leak valid handles and keeps password login MFA-pending", async () => {
    const s = await staff();
    const denied = await auth(
      request("/api/auth/staff", "POST", "", {
        handle: s.user.handle,
        password: "incorrect",
      }),
      acontext("staff"),
    );
    expect(denied.status).toBe(401);
    const response = await auth(
      request("/api/auth/staff", "POST", "", {
        handle: s.user.handle,
        password: s.password,
      }),
      acontext("staff"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const current = await session(
      request("/api/auth/me", "GET", cookie(response)),
    );
    expect(current?.mfaVerified).toBe(false);
    expect(current?.tokenHash).not.toBe(
      cookie(response).slice(COOKIE.length + 1),
    );
  });
  it("rate-limits repeated MFA failures using PostgreSQL counters", async () => {
    const s = await staff("OWNER", false);
    const setup = await payload(
      await auth(
        request("/api/auth/mfa-setup", "POST", s.cookie, {}),
        acontext("mfa-setup"),
      ),
    );
    const wrong = ((Number(totp(setup.data.secret)) + 10) % 1000000)
      .toString()
      .padStart(6, "0");
    for (let i = 0; i < 5; i++)
      expect(
        (
          await auth(
            request("/api/auth/mfa-verify", "POST", s.cookie, { code: wrong }),
            acontext("mfa-verify"),
          )
        ).status,
      ).toBe(401);
    expect(
      (
        await auth(
          request("/api/auth/mfa-verify", "POST", s.cookie, { code: wrong }),
          acontext("mfa-verify"),
        )
      ).status,
    ).toBe(429);
  });
  it("enforces server-side permission boundaries even for MFA-verified staff", async () => {
    const content = await staff("CONTENT"),
      support = await staff("SUPPORT"),
      c = await customer();
    await apply(
      request("/api/partner", "POST", c.cookie, {
        businessName: "فروشگاه نمونه",
        city: "تهران",
        note: "درخواست همکاری آزمایشی",
      }),
    );
    const p = await db().partnerAccount.findFirstOrThrow();
    expect(
      (
        await review(
          request("/api/admin/partners/" + p.id, "PATCH", content.cookie, {
            status: "APPROVED",
            version: 1,
            reason: "آزمون عدم دسترسی",
          }),
          context(p.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await admin(request("/api/admin/staff", "GET", support.cookie), {
          params: Promise.resolve({ module: "staff" }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await admin(request("/api/admin/partners", "GET", support.cookie), {
          params: Promise.resolve({ module: "partners" }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await admin(request("/api/admin/dashboard", "GET", c.cookie), {
          params: Promise.resolve({ module: "dashboard" }),
        })
      ).status,
    ).toBe(403);
  });
  it("serializes partner decisions and rejects stale versions without duplicate approval", async () => {
    const c = await customer(),
      s = await staff();
    expect(
      (
        await apply(
          request("/api/partner", "POST", c.cookie, {
            businessName: "فروشگاه من",
            city: "شیراز",
            note: "متقاضی خرید از یک جین",
          }),
        )
      ).status,
    ).toBe(201);
    const p = await db().partnerAccount.findFirstOrThrow();
    const results = await Promise.all(
      ["APPROVED", "REJECTED"].map((status) =>
        review(
          request("/api/admin/partners/" + p.id, "PATCH", s.cookie, {
            status,
            version: 1,
            reason: "بررسی هم‌زمان پرونده",
          }),
          context(p.id),
        ),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await db().auditLog.count({
        where: {
          resourceId: p.id,
          action: { in: ["partner:approve", "partner:review"] },
        },
      }),
    ).toBe(1);
    const own = (
      await payload(await partnerMe(request("/api/partner", "GET", c.cookie)))
    ).data;
    expect(own.pricingReady).toBe(false);
    expect(own.minPacks).toBe(1);
    expect(own.minAmountToman).toBe("0");
    expect(JSON.stringify(own)).not.toContain("wholesalePrice");
  });
  it("prevents self-approval even for an owner", async () => {
    const s = await staff();
    const p = await db().partnerAccount.create({
      data: {
        userId: s.user.id,
        businessName: "خود مالک",
        city: "تهران",
        note: "پروندهٔ آزمون حفاظت",
      },
    });
    expect(
      (
        await review(
          request("/api/admin/partners/" + p.id, "PATCH", s.cookie, {
            status: "APPROVED",
            version: 1,
            reason: "تأیید درخواست خودم",
          }),
          context(p.id),
        )
      ).status,
    ).toBe(403);
  });
  it("revokes logout, expired, inactive, and version-stale sessions on the server", async () => {
    const c = await customer();
    expect(
      await session(request("/api/auth/me", "GET", c.cookie)),
    ).not.toBeNull();
    await auth(
      request("/api/auth/logout", "POST", c.cookie, {}),
      acontext("logout"),
    );
    expect(await session(request("/api/auth/me", "GET", c.cookie))).toBeNull();
    const s = await staff();
    await db().session.update({
      where: { id: s.session.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect(await session(request("/api/auth/me", "GET", s.cookie))).toBeNull();
    const next = await createSession(s.user.id, 1, true);
    await db().user.update({
      where: { id: s.user.id },
      data: { permissionVersion: { increment: 1 } },
    });
    expect(
      await session(request("/api/auth/me", "GET", COOKIE + "=" + next.token)),
    ).toBeNull();
    const last = await createSession(s.user.id, 2, true);
    await db().user.update({
      where: { id: s.user.id },
      data: { isActive: false },
    });
    expect(
      await session(request("/api/auth/me", "GET", COOKIE + "=" + last.token)),
    ).toBeNull();
  });
  it("paginates large reply threads and refuses cursors from a different post", async () => {
    const c = await customer();
    const root = (await payload(await add(c.cookie))).data;
    await db().comment.createMany({
      data: Array.from({ length: 41 }, (_, i) => ({
        postId: "everyday-bag",
        userId: c.id,
        parentId: root.id,
        body: "پاسخ " + i,
        clientMutationId: randomUUID(),
      })),
    });
    const first = (
      await payload(
        await list(
          request("/api/posts/everyday-bag/comments"),
          context("everyday-bag"),
        ),
      )
    ).data;
    expect(first.count).toBe(42);
    expect(first.items).toHaveLength(21);
    expect(first.items[0].replyCursor).toBeTruthy();
    const second = (
      await payload(
        await list(
          request(
            "/api/posts/everyday-bag/comments?root=" +
              root.id +
              "&cursor=" +
              first.items[0].replyCursor,
          ),
          context("everyday-bag"),
        ),
      )
    ).data;
    expect(second.items).toHaveLength(20);
    expect(second.nextCursor).toBeTruthy();
    const last = (
      await payload(
        await list(
          request(
            "/api/posts/everyday-bag/comments?root=" +
              root.id +
              "&cursor=" +
              second.nextCursor,
          ),
          context("everyday-bag"),
        ),
      )
    ).data;
    expect(last.items).toHaveLength(1);
    expect(last.nextCursor).toBeNull();
    expect(
      (
        await list(
          request("/api/posts/minimal-watch/comments?cursor=" + root.id),
          context("minimal-watch"),
        )
      ).status,
    ).toBe(422);
  });
  it("rejects oversized JSON before allocating an unbounded body and secures HTTPS cookies", async () => {
    const large = await auth(
      request("/api/auth/demo", "POST", "", { filler: "x".repeat(17000) }),
      acontext("demo"),
    );
    expect(large.status).toBe(413);
    const response = await auth(
      request(
        "/api/auth/demo",
        "POST",
        "",
        {},
        { "x-forwarded-proto": "https" },
      ),
      acontext("demo"),
    );
    expect(response.headers.get("set-cookie")).toContain("Secure");
    const missing = new Request(origin + "/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect((await auth(missing, acontext("demo"))).status).toBe(403);
  });
  it("bootstraps exactly one owner from the local CLI without a default password", async () => {
    const password = "test-owner-" + randomUUID();
    const options = {
      cwd: process.cwd(),
      env: { ...process.env, KIYA_OWNER_PASSWORD: password },
      encoding: "utf8" as const,
    };
    const args = [
      "scripts/create-owner.mjs",
      "--handle",
      "cli-owner",
      "--name",
      "مالک آزمون",
    ];
    const result = spawnSync(process.execPath, args, options);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain(password);
    const owner = await db().user.findUniqueOrThrow({
      where: { handle: "cli-owner" },
    });
    expect(owner.mfaEnabled).toBe(false);
    expect(passwordMatches(password, owner.passwordHash!)).toBe(true);
    expect(spawnSync(process.execPath, args, options).status).toBe(1);
  });
});
