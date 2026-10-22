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
import { POST as createProduct } from "@/app/api/admin/products/route";
import { PATCH as editProduct } from "@/app/api/admin/products/[id]/route";
import { GET as access } from "@/app/api/admin/access/route";
import { POST as createRole } from "@/app/api/admin/roles/route";
import { PATCH as editRole } from "@/app/api/admin/roles/[id]/route";
import { POST as createStaff } from "@/app/api/admin/staff/route";
import { PATCH as editStaff } from "@/app/api/admin/staff/[id]/route";
import sharp from "sharp";
import { rm } from "node:fs/promises";
import { GET as catalogApi } from "@/app/api/catalog/route";
import { publicProduct } from "@/server/catalog";
import { POST as uploadApi } from "@/app/api/admin/media/route";
import { GET as mediaApi } from "@/app/api/media/[id]/route";
import { PUT as detailsApi } from "@/app/api/admin/products/[id]/details/route";
import { POST as variantApi } from "@/app/api/admin/products/[id]/variants/route";
import { PATCH as variantEditApi } from "@/app/api/admin/products/[id]/variants/[variantId]/route";
import { PATCH as statusApi } from "@/app/api/admin/products/[id]/status/route";
import { POST as stockApi } from "@/app/api/admin/inventory/[variantId]/route";
import { GET as stockReadApi } from "@/app/api/admin/products/[id]/inventory/route";
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

async function uploadPhoto(cookie: string, bytes: Buffer, type = "image/png") {
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)], { type }), "test-photo");
  return uploadApi(
    new Request(origin + "/api/admin/media", {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie },
      body: form,
    }),
  );
}
async function newSku(owner: Awaited<ReturnType<typeof staff>>) {
  const p = (
    await payload(
      await createProduct(
        request("/api/admin/products", "POST", owner.cookie, {
          name: "کالای آزمون موجودی",
          price: "250000",
        }),
      ),
    )
  ).data;
  const v = (
    await payload(
      await variantApi(
        request(
          "/api/admin/products/" + p.id + "/variants",
          "POST",
          owner.cookie,
          {
            name: "بنفش",
            hex: "#482780",
            sku: "TEST-" + randomUUID().slice(0, 8),
          },
        ),
        context(p.id),
      ),
    )
  ).data;
  return { p, v };
}
function stockContext(variantId: string) {
  return { params: Promise.resolve({ variantId }) };
}
async function move(
  cookie: string,
  v: string,
  delta: number,
  version = 1,
  requestId = randomUUID(),
  reason = "اصلاح موجودی آزمون",
) {
  return stockApi(
    request("/api/admin/inventory/" + v, "POST", cookie, {
      delta,
      version,
      requestId,
      reason,
    }),
    stockContext(v),
  );
}
async function prepared(owner: Awaited<ReturnType<typeof staff>>) {
  const { p, v } = await newSku(owner);
  const bytes = await sharp({
    create: { width: 300, height: 300, channels: 3, background: "#482780" },
  })
    .withMetadata({ exif: { IFD0: { Artist: "SYNTHETIC_PRIVATE_EXIF" } } })
    .jpeg()
    .toBuffer();
  const photo = (
    await payload(await uploadPhoto(owner.cookie, bytes, "image/jpeg"))
  ).data;
  const record = await db().product.findUniqueOrThrow({ where: { id: p.id } });
  const details = {
    name: "کیف آزمون انتشار",
    price: "250000",
    subtitle: "کیف کوچک آزمون",
    category: "کیف و کیف پول",
    description: "توضیحات کامل نمونه برای آزمون انتشار واقعی کالا در ویترین.",
    imagePath: photo.url,
    packSize: 6,
    tag: "آزمون",
    collection: "کاتالوگ آزمون",
    version: record.version,
  };
  expect(
    (
      await detailsApi(
        request(
          "/api/admin/products/" + p.id + "/details",
          "PUT",
          owner.cookie,
          details,
        ),
        context(p.id),
      )
    ).status,
  ).toBe(200);
  return { p, v, photo };
}
async function transition(
  cookie: string,
  id: string,
  status: string,
  version?: number,
) {
  const p = await db().product.findUniqueOrThrow({ where: { id } });
  return statusApi(
    request("/api/admin/products/" + id + "/status", "PATCH", cookie, {
      status,
      version: version ?? p.version,
      reason: "تغییر وضعیت برای آزمون",
    }),
    context(id),
  );
}
beforeEach(async () => {
  await db().$executeRawUnsafe('TRUNCATE "InventoryMovement"');
  await db().productVariant.deleteMany({
    where: { productId: { startsWith: "draft-" } },
  });
  await db().product.deleteMany({ where: { id: { startsWith: "draft-" } } });
  await db().$executeRawUnsafe(
    'TRUNCATE "UserRole","Session","RecoveryCode","Comment","PartnerAccount","AuditLog","RateBucket","User" CASCADE',
  );
  await db().mediaAsset.deleteMany();
  await db().role.deleteMany({ where: { key: { startsWith: "CUSTOM_" } } });
});
afterAll(async () => {
  await rm(process.cwd() + "/.data/test-media", {
    recursive: true,
    force: true,
  });
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
  it("creates private drafts only for MFA-verified writers with transactional audit", async () => {
    const content = await staff("CONTENT"),
      owner = await staff("OWNER"),
      pending = await staff("OWNER", false);
    const input = { name: "کالای پیش‌نویس آزمون", price: "1450000" };
    for (const [cookie, status] of [
      ["", 401],
      [content.cookie, 403],
      [pending.cookie, 403],
    ] as const)
      expect(
        (
          await createProduct(
            request("/api/admin/products", "POST", cookie, input),
          )
        ).status,
      ).toBe(status);
    const response = await createProduct(
      request("/api/admin/products", "POST", owner.cookie, input),
    );
    expect(response.status).toBe(201);
    const result = (await payload(response)).data;
    expect(result.status).toBe("DRAFT");
    expect(result.price).toBe("1450000");
    expect(result.version).toBe(1);
    expect(
      (
        await list(
          request("/api/posts/" + result.id + "/comments"),
          context(result.id),
        )
      ).status,
    ).toBe(404);
    expect(
      await db().auditLog.count({
        where: { action: "product:draft_create", resourceId: result.id },
      }),
    ).toBe(1);
  });
  it("validates exact decimal strings and rejects attempts to publish through draft APIs", async () => {
    const owner = await staff("OWNER");
    for (const price of [1.5, "-1", "1.5", "100000000000000", "01"])
      expect(
        (
          await createProduct(
            request("/api/admin/products", "POST", owner.cookie, {
              name: "آزمون نام کالا",
              price,
            }),
          )
        ).status,
      ).toBe(422);
    expect(
      (
        await createProduct(
          request("/api/admin/products", "POST", owner.cookie, {
            name: "آزمون نام کالا",
            price: "100",
            status: "PUBLISHED",
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await createProduct(
          request(
            "/api/admin/products",
            "POST",
            owner.cookie,
            { name: "آزمون نام کالا", price: "100" },
            { Origin: "https://evil.example" },
          ),
        )
      ).status,
    ).toBe(403);
  });
  it("serializes concurrent draft edits and refuses stale updates", async () => {
    const owner = await staff("OWNER");
    const p = (
      await payload(
        await createProduct(
          request("/api/admin/products", "POST", owner.cookie, {
            name: "پیش‌نویس اولیه",
            price: "100",
          }),
        ),
      )
    ).data;
    const results = await Promise.all(
      ["200", "300"].map((price) =>
        editProduct(
          request("/api/admin/products/" + p.id, "PATCH", owner.cookie, {
            name: "نام ویرایش شده",
            price,
            version: 1,
          }),
          context(p.id),
        ),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await db().product.findUniqueOrThrow({ where: { id: p.id } })).version,
    ).toBe(2);
    expect(
      await db().auditLog.count({
        where: { resourceId: p.id, action: "product:draft_update" },
      }),
    ).toBe(1);
  });
  it("does not change published storefront prices from the draft editor", async () => {
    const owner = await staff("OWNER");
    const p = await db().product.findUniqueOrThrow({
      where: { id: "everyday-bag" },
    });
    const response = await editProduct(
      request("/api/admin/products/" + p.id, "PATCH", owner.cookie, {
        name: "تغییر غیرمجاز نمونه",
        price: "1",
        version: p.version,
      }),
      context(p.id),
    );
    expect(response.status).toBe(409);
    expect(
      (
        await db().product.findUniqueOrThrow({ where: { id: p.id } })
      ).price.toString(),
    ).toBe(p.price.toString());
  });
  it("protects access management with real-owner membership plus MFA, not client role flags", async () => {
    expect((await access(request("/api/admin/access"))).status).toBe(401);
    for (const who of [
      await customer(),
      await staff("SUPPORT"),
      await staff("OWNER", false),
    ])
      expect(
        (await access(request("/api/admin/access", "GET", who.cookie))).status,
      ).toBe(403);
    await db().role.create({
      data: {
        key: "CUSTOM_FORGED",
        name: "آزمون مجوز",
        permissions: ["staff:manage", "role:manage"],
      },
    });
    const forged = await staff("CUSTOM_FORGED");
    expect(
      (await access(request("/api/admin/access", "GET", forged.cookie))).status,
    ).toBe(403);
    const owner = await staff();
    const p = await payload(
      await access(request("/api/admin/access", "GET", owner.cookie)),
    );
    expect(p.ok).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/passwordHash|mfaSecret|tokenHash/);
  });
  it("creates a custom action role but does not delegate owner-only IAM permissions", async () => {
    const owner = await staff();
    const response = await createRole(
      request("/api/admin/roles", "POST", owner.cookie, {
        name: "پاسخ‌گوی دیدگاه",
        permissions: ["dashboard:read", "comment:read", "comment:reply"],
      }),
    );
    expect(response.status).toBe(201);
    const role = (await payload(response)).data;
    expect(role.key).toMatch(/^CUSTOM_/);
    expect(
      (
        await createRole(
          request("/api/admin/roles", "POST", owner.cookie, {
            name: "اختیار نامعتبر",
            permissions: ["staff:manage"],
          }),
        )
      ).status,
    ).toBe(422);
    const builtin = await db().role.findUniqueOrThrow({
      where: { key: "OWNER" },
    });
    expect(
      (
        await editRole(
          request("/api/admin/roles/" + builtin.id, "PATCH", owner.cookie, {
            name: "ویرایش ممنوع",
            permissions: ["dashboard:read"],
            version: builtin.version,
          }),
          context(builtin.id),
        )
      ).status,
    ).toBe(403);
  });
  it("creates unverified staff with a password hash and requires explicit owner-grant confirmation", async () => {
    const owner = await staff();
    const role = await db().role.findUniqueOrThrow({
      where: { key: "SUPPORT" },
    });
    const input = {
      name: "پرسنل تازه",
      handle: "fresh_staff",
      phone: "09120000001",
      password: "isolated-test-password-123",
      roleIds: [role.id],
    };
    const result = await createStaff(
      request("/api/admin/staff", "POST", owner.cookie, input),
    );
    expect(result.status).toBe(201);
    const data = (await payload(result)).data;
    expect(data.mfaEnabled).toBe(false);
    expect(JSON.stringify(data)).not.toMatch(/password|phone/);
    const u = await db().user.findUniqueOrThrow({ where: { id: data.id } });
    expect(u.kind).toBe("STAFF");
    expect(u.phoneVerifiedAt).toBeNull();
    expect(u.phone).toBe("+989120000001");
    expect(passwordMatches(input.password, u.passwordHash!)).toBe(true);
    expect(
      (
        await createStaff(
          request("/api/admin/staff", "POST", owner.cookie, input),
        )
      ).status,
    ).toBe(409);
    const ownerRole = await db().role.findUniqueOrThrow({
      where: { key: "OWNER" },
    });
    expect(
      (
        await createStaff(
          request("/api/admin/staff", "POST", owner.cookie, {
            ...input,
            handle: "other_owner",
            phone: "",
            roleIds: [ownerRole.id],
          }),
        )
      ).status,
    ).toBe(422);
  });
  it("revokes sessions immediately when a staff account is suspended or reassigned", async () => {
    const owner = await staff(),
      support = await staff("SUPPORT");
    const role = await db().role.findUniqueOrThrow({
      where: { key: "CONTENT" },
    });
    const result = await editStaff(
      request("/api/admin/staff/" + support.user.id, "PATCH", owner.cookie, {
        isActive: false,
        roleIds: [role.id],
        version: 1,
        reason: "تعلیق حساب آزمون",
      }),
      context(support.user.id),
    );
    expect(result.status).toBe(200);
    expect(
      await session(request("/api/auth/me", "GET", support.cookie)),
    ).toBeNull();
    expect(
      (await db().user.findUniqueOrThrow({ where: { id: support.user.id } }))
        .permissionVersion,
    ).toBe(2);
    expect(
      (
        await editStaff(
          request(
            "/api/admin/staff/" + support.user.id,
            "PATCH",
            owner.cookie,
            {
              isActive: true,
              roleIds: [role.id],
              version: 1,
              reason: "ویرایش قدیمی",
            },
          ),
          context(support.user.id),
        )
      ).status,
    ).toBe(409);
  });
  it("revokes all assignee sessions after an optimistic custom-role update", async () => {
    const owner = await staff();
    const r = await db().role.create({
      data: {
        key: "CUSTOM_ASSIGNED",
        name: "نقش قابل تغییر",
        permissions: ["dashboard:read", "product:read"],
      },
    });
    const user = await staff(r.key);
    const body = {
      name: "نقش کم‌دسترسی",
      permissions: ["dashboard:read"],
      version: 1,
    };
    expect(
      (
        await editRole(
          request("/api/admin/roles/" + r.id, "PATCH", owner.cookie, body),
          context(r.id),
        )
      ).status,
    ).toBe(200);
    expect(
      await session(request("/api/auth/me", "GET", user.cookie)),
    ).toBeNull();
    expect(
      (
        await editRole(
          request("/api/admin/roles/" + r.id, "PATCH", owner.cookie, body),
          context(r.id),
        )
      ).status,
    ).toBe(409);
  });
  it("keeps a last active owner and refuses self-management", async () => {
    const owner = await staff(),
      supportRole = await db().role.findUniqueOrThrow({
        where: { key: "SUPPORT" },
      }),
      ownerRole = await db().role.findUniqueOrThrow({
        where: { key: "OWNER" },
      });
    expect(
      (
        await editStaff(
          request("/api/admin/staff/" + owner.user.id, "PATCH", owner.cookie, {
            isActive: false,
            roleIds: [supportRole.id],
            version: 1,
            reason: "آزمون آخرین مالک",
          }),
          context(owner.user.id),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await editStaff(
          request("/api/admin/staff/" + owner.user.id, "PATCH", owner.cookie, {
            isActive: true,
            roleIds: [ownerRole.id],
            version: 1,
            reason: "تغییر حساب خودم",
            ownerConfirmed: true,
          }),
          context(owner.user.id),
        )
      ).status,
    ).toBe(403);
  });
  it("serializes opposite-owner suspension requests so two owners cannot both disappear", async () => {
    const a = await staff(),
      b = await staff(),
      role = await db().role.findUniqueOrThrow({ where: { key: "OWNER" } });
    const body = {
      isActive: false,
      roleIds: [role.id],
      version: 1,
      reason: "تعلیق هم‌زمان آزمون",
      ownerConfirmed: true,
    };
    const results = await Promise.all([
      editStaff(
        request("/api/admin/staff/" + b.user.id, "PATCH", a.cookie, body),
        context(b.user.id),
      ),
      editStaff(
        request("/api/admin/staff/" + a.user.id, "PATCH", b.cookie, body),
        context(a.user.id),
      ),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(
      await db().user.count({
        where: {
          kind: "STAFF",
          isActive: true,
          roles: { some: { role: { key: "OWNER" } } },
        },
      }),
    ).toBe(1);
  });
  it("normalizes phone login formats without claiming SMS verification", async () => {
    const s = await staff("OWNER", false);
    await db().user.update({
      where: { id: s.user.id },
      data: { phone: "+989120000001" },
    });
    for (const handle of ["09120000001", "+989120000001", "۰۹۱۲۰۰۰۰۰۰۱"]) {
      const response = await auth(
        request("/api/auth/staff", "POST", "", {
          handle,
          password: s.password,
        }),
        acontext("staff"),
      );
      expect(response.status).toBe(200);
      expect((await payload(response)).data.mfaRequired).toBe(true);
    }
    expect(
      (await db().user.findUniqueOrThrow({ where: { id: s.user.id } }))
        .phoneVerifiedAt,
    ).toBeNull();
  });
  it("changes the current staff password only after MFA and revokes every session", async () => {
    const s = await staff("SUPPORT"),
      pending = await staff("OWNER", false);
    const newPassword = "new-isolated-password-456";
    expect(
      (
        await auth(
          request("/api/auth/password", "POST", pending.cookie, {
            oldPassword: pending.password,
            newPassword,
          }),
          acontext("password"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await auth(
          request("/api/auth/password", "POST", s.cookie, {
            oldPassword: "incorrect",
            newPassword,
          }),
          acontext("password"),
        )
      ).status,
    ).toBe(401);
    const extra = await createSession(s.user.id, 1, true);
    expect(
      (
        await auth(
          request("/api/auth/password", "POST", s.cookie, {
            oldPassword: s.password,
            newPassword,
          }),
          acontext("password"),
        )
      ).status,
    ).toBe(200);
    expect(await session(request("/api/auth/me", "GET", s.cookie))).toBeNull();
    expect(
      await session(request("/api/auth/me", "GET", COOKIE + "=" + extra.token)),
    ).toBeNull();
    const changed = await db().user.findUniqueOrThrow({
      where: { id: s.user.id },
    });
    expect(passwordMatches(newPassword, changed.passwordHash!)).toBe(true);
    expect(passwordMatches(s.password, changed.passwordHash!)).toBe(false);
    expect(
      JSON.stringify(
        await db().auditLog.findMany({
          where: { action: "auth:password_changed" },
        }),
      ),
    ).not.toContain(newPassword);
  });
  it("serves catalog DTOs from PostgreSQL without SKU, exact stock or private fields", async () => {
    const data = (await payload(await catalogApi())).data.items;
    expect(data).toHaveLength(5);
    expect(data[0].id).toBe("everyday-bag");
    expect(data[0].price).toBe("1450000");
    expect(data[0].isDemo).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(
      /"stock"|"reserved"|"sku"|"passwordHash"/,
    );
    process.env.APP_MODE = "live";
    try {
      expect((await payload(await catalogApi())).data.items).toHaveLength(0);
    } finally {
      process.env.APP_MODE = "demo";
    }
  });
  it("requires complete metadata and a real uploaded photo before publication", async () => {
    const owner = await staff();
    const { p } = await newSku(owner);
    expect((await transition(owner.cookie, p.id, "PUBLISHED")).status).toBe(
      422,
    );
    const record = await db().product.findUniqueOrThrow({
      where: { id: p.id },
    });
    const input = {
      name: p.name,
      price: "1",
      subtitle: "نمونه",
      category: "لباس معمولی",
      description: "توضیح نمونه",
      imagePath: "https://evil.example/p.jpg",
      packSize: 6,
      tag: "",
      collection: "",
      version: record.version,
    };
    expect(
      (
        await detailsApi(
          request(
            "/api/admin/products/" + p.id + "/details",
            "PUT",
            owner.cookie,
            input,
          ),
          context(p.id),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await detailsApi(
          request(
            "/api/admin/products/" + p.id + "/details",
            "PUT",
            owner.cookie,
            { ...input, category: "لباس زیر", imagePath: "/images/bag.webp" },
          ),
          context(p.id),
        )
      ).status,
    ).toBe(422);
  });
  it("sanitizes uploaded images, keeps drafts private, publishes and archives without leaks", async () => {
    const owner = await staff();
    const { p, photo } = await prepared(owner);
    const mediaId = photo.id;
    expect(
      (await mediaApi(request("/api/media/" + mediaId), context(mediaId)))
        .status,
    ).toBe(404);
    const privateImage = await mediaApi(
      request("/api/media/" + mediaId, "GET", owner.cookie),
      context(mediaId),
    );
    expect(privateImage.status).toBe(200);
    const metadata = await sharp(
      Buffer.from(await privateImage.arrayBuffer()),
    ).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(await publicProduct(p.id)).toBeNull();
    expect((await transition(owner.cookie, p.id, "PUBLISHED")).status).toBe(
      200,
    );
    const visible = await publicProduct(p.id);
    expect(visible?.name).toBe("کیف آزمون انتشار");
    expect(visible?.colors[0].available).toBe(false);
    expect(
      (await mediaApi(request("/api/media/" + mediaId), context(mediaId)))
        .status,
    ).toBe(200);
    expect((await transition(owner.cookie, p.id, "ARCHIVED")).status).toBe(200);
    expect(await publicProduct(p.id)).toBeNull();
    expect(
      (await mediaApi(request("/api/media/" + mediaId), context(mediaId)))
        .status,
    ).toBe(404);
  });
  it("rejects anonymous, SVG, tiny, malformed and oversized image uploads", async () => {
    const owner = await staff();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><script>alert(1)</script></svg>',
    );
    expect((await uploadPhoto("", svg, "image/svg+xml")).status).toBe(401);
    expect((await uploadPhoto(owner.cookie, svg, "image/svg+xml")).status).toBe(
      422,
    );
    const tiny = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    expect((await uploadPhoto(owner.cookie, tiny)).status).toBe(422);
    expect(
      (await uploadPhoto(owner.cookie, Buffer.from("not an image"))).status,
    ).toBe(422);
    const response = await uploadApi(
      new Request(origin + "/api/admin/media", {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: owner.cookie,
          "Content-Type": "multipart/form-data; boundary=x",
          "Content-Length": "7000000",
        },
        body: "x",
      }),
    );
    expect(response.status).toBe(413);
  });
  it("enforces globally unique SKUs, same-product variants, and optimistic color updates", async () => {
    const owner = await staff();
    const { p, v } = await newSku(owner);
    const existing = await db().productVariant.findUniqueOrThrow({
      where: { id: v.id },
    });
    expect(
      (
        await variantApi(
          request(
            "/api/admin/products/" + p.id + "/variants",
            "POST",
            owner.cookie,
            { name: "رنگ دیگر", hex: "#112233", sku: existing.sku },
          ),
          context(p.id),
        )
      ).status,
    ).toBe(409);
    const another = await newSku(owner);
    const cross = await variantEditApi(
      request(
        "/api/admin/products/" + another.p.id + "/variants/" + v.id,
        "PATCH",
        owner.cookie,
        { name: "بنفش", hex: "#112233", isActive: true, version: 1 },
      ),
      { params: Promise.resolve({ id: another.p.id, variantId: v.id }) },
    );
    expect(cross.status).toBe(404);
    const edit = () =>
      variantEditApi(
        request(
          "/api/admin/products/" + p.id + "/variants/" + v.id,
          "PATCH",
          owner.cookie,
          { name: "بنفش تازه", hex: "#112233", isActive: true, version: 1 },
        ),
        { params: Promise.resolve({ id: p.id, variantId: v.id }) },
      );
    expect((await edit()).status).toBe(200);
    expect((await edit()).status).toBe(409);
  });
  it("separates stock/publishing permissions from product-read and customer access", async () => {
    const owner = await staff(),
      content = await staff("CONTENT"),
      c = await customer();
    const { p, v } = await newSku(owner);
    expect(
      (
        await stockReadApi(
          request(
            "/api/admin/products/" + p.id + "/inventory",
            "GET",
            content.cookie,
          ),
          context(p.id),
        )
      ).status,
    ).toBe(403);
    expect((await move(content.cookie, v.id, 1)).status).toBe(403);
    expect((await move(c.cookie, v.id, 1)).status).toBe(403);
    expect((await transition(content.cookie, p.id, "PUBLISHED")).status).toBe(
      403,
    );
  });
  it("idempotently applies parallel retries once with one ledger and audit record", async () => {
    const owner = await staff();
    const { v } = await newSku(owner),
      key = randomUUID();
    const [a, b] = await Promise.all([
      move(owner.cookie, v.id, 10, 1, key),
      move(owner.cookie, v.id, 10, 1, key),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect((await payload(a)).data).toEqual((await payload(b)).data);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: v.id } }))
        .stock,
    ).toBe(10);
    expect(
      await db().inventoryMovement.count({ where: { variantId: v.id } }),
    ).toBe(1);
    expect(
      await db().auditLog.count({ where: { action: "inventory:adjust" } }),
    ).toBe(1);
    expect((await move(owner.cookie, v.id, 11, 1, key)).status).toBe(409);
  });
  it("serializes distinct concurrent stock changes and prevents lost updates", async () => {
    const owner = await staff();
    const { v } = await newSku(owner);
    const results = await Promise.all([
      move(owner.cookie, v.id, 10),
      move(owner.cookie, v.id, 10),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const record = await db().productVariant.findUniqueOrThrow({
      where: { id: v.id },
    });
    expect(record.stock).toBe(10);
    expect(record.version).toBe(2);
  });
  it("rejects negative stock and reduction below reservations without partial ledger writes", async () => {
    const owner = await staff();
    const { v } = await newSku(owner);
    expect((await move(owner.cookie, v.id, -1)).status).toBe(409);
    expect((await move(owner.cookie, v.id, 5)).status).toBe(201);
    await db().productVariant.update({
      where: { id: v.id },
      data: { reserved: 3 },
    });
    expect((await move(owner.cookie, v.id, -3, 2)).status).toBe(409);
    expect(
      await db().inventoryMovement.count({ where: { variantId: v.id } }),
    ).toBe(1);
    expect((await move(owner.cookie, v.id, -1, 2)).status).toBe(201);
  });
  it("keeps stock/reserved invariants and an append-only stock ledger at the database layer", async () => {
    const owner = await staff();
    const { v } = await newSku(owner);
    await expect(
      db().productVariant.update({ where: { id: v.id }, data: { stock: -1 } }),
    ).rejects.toThrow();
    await expect(
      db().productVariant.update({
        where: { id: v.id },
        data: { reserved: 1 },
      }),
    ).rejects.toThrow();
    await move(owner.cookie, v.id, 4);
    const movement = await db().inventoryMovement.findFirstOrThrow({
      where: { variantId: v.id },
    });
    await expect(
      db().inventoryMovement.delete({ where: { id: movement.id } }),
    ).rejects.toThrow();
    await expect(
      db().inventoryMovement.update({
        where: { id: movement.id },
        data: { delta: 100 },
      }),
    ).rejects.toThrow();
  });
  it("requires archive-to-draft transitions, a current version, and preserves stock through publication", async () => {
    const owner = await staff();
    const { p, v } = await prepared(owner);
    await move(owner.cookie, v.id, 3);
    expect((await transition(owner.cookie, p.id, "PUBLISHED")).status).toBe(
      200,
    );
    expect((await publicProduct(p.id))?.colors[0].available).toBe(true);
    expect((await transition(owner.cookie, p.id, "DRAFT")).status).toBe(409);
    expect((await transition(owner.cookie, p.id, "ARCHIVED", 1)).status).toBe(
      409,
    );
    expect((await transition(owner.cookie, p.id, "ARCHIVED")).status).toBe(200);
    expect((await transition(owner.cookie, p.id, "DRAFT")).status).toBe(200);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: v.id } }))
        .stock,
    ).toBe(3);
  });
});
