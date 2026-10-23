import { matchesBootstrapOwner } from "@/server/telegram-identity";
import { POST as promote } from "@/app/api/admin/staff/promote/route";
import { beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { db } from "@/server/db";
import { createSession, COOKIE, session } from "@/server/auth";
import {
  passwordHash,
  passwordMatches,
  totp,
  decrypt,
  encrypt,
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
import { rm, mkdir, writeFile } from "node:fs/promises";
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
import {
  GET as packsRead,
  POST as packsCreate,
} from "@/app/api/admin/products/[id]/packs/route";
import { PUT as packsEdit } from "@/app/api/admin/products/[id]/packs/[packId]/route";
import { PATCH as packsStatus } from "@/app/api/admin/products/[id]/packs/[packId]/status/route";
import {
  GET as offersRead,
  POST as offersCreate,
} from "@/app/api/admin/products/[id]/offers/route";
import { PATCH as offersStatus } from "@/app/api/admin/products/[id]/offers/[offerId]/status/route";
import { GET as wholesaleRead } from "@/app/api/wholesale/catalog/route";
import { PUT as validityApi } from "@/app/api/admin/partners/[id]/validity/route";
import {
  GET as cartRead,
  POST as cartAdd,
  PATCH as cartSet,
} from "@/app/api/cart/route";
import { POST as cartQuote } from "@/app/api/cart/quote/route";
import {
  POST as reserveOrder,
  GET as ordersRead,
} from "@/app/api/orders/route";
import { POST as orderCancel } from "@/app/api/orders/[id]/cancel/route";
import { releaseExpiredOrders } from "@/server/orders";
import {
  GET as settingsGet,
  PUT as settingsPut,
} from "@/app/api/admin/settings/route";
import { POST as telegramAuth } from "@/app/api/auth/telegram/route";
import { POST as telegramHook } from "@/app/api/webhooks/telegram/route";
import {
  GET as manualGet,
  POST as manualCreate,
} from "@/app/api/payments/route";
import {
  POST as receiptPost,
  GET as receiptGet,
} from "@/app/api/payments/[id]/receipt/route";
import { POST as paymentReview } from "@/app/api/admin/payments/[id]/route";
import { POST as telegramHealth } from "@/app/api/admin/settings/telegram/route";
import { GET as financeList } from "@/app/api/admin/payments/route";
import { validCard } from "@/server/settings";
import { GET as fulfillmentList } from "@/app/api/admin/orders/route";
import { POST as fulfill } from "@/app/api/admin/orders/[id]/route";
import {
  GET as supportListApi,
  POST as supportCreateApi,
} from "@/app/api/support/route";
import {
  GET as supportReadApi,
  POST as supportMessageApi,
  PATCH as supportStatusApi,
} from "@/app/api/support/[id]/route";
import { GET as staffSupportList } from "@/app/api/admin/support/route";
import {
  GET as staffSupportRead,
  POST as staffSupportMessage,
  PATCH as staffSupportStatus,
} from "@/app/api/admin/support/[id]/route";
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

function packContext(id: string, packId: string) {
  return { params: Promise.resolve({ id, packId }) };
}
function packBody(variantId: string, units = 6) {
  return {
    label: "جین واقعی آزمون",
    mode: "HOMOGENEOUS",
    components: [{ variantId, units }],
  };
}
async function addPack(
  cookie: string,
  id: string,
  variantId: string,
  units = 6,
) {
  return packsCreate(
    request(
      "/api/admin/products/" + id + "/packs",
      "POST",
      cookie,
      packBody(variantId, units),
    ),
    context(id),
  );
}
async function packState(
  cookie: string,
  id: string,
  packId: string,
  status: string,
  version = 1,
) {
  return packsStatus(
    request(
      "/api/admin/products/" + id + "/packs/" + packId + "/status",
      "PATCH",
      cookie,
      { status, version, reason: "تغییر وضعیت جین آزمون" },
    ),
    packContext(id, packId),
  );
}

async function wholesaleFixture() {
  const owner = await staff(),
    reviewer = await staff(),
    buyer = await customer();
  const partner = await db().partnerAccount.create({
    data: {
      userId: buyer.id,
      businessName: "همکار آزمون قیمت خصوصی",
      city: "تهران",
      note: "داده مصنوعی تست",
      status: "APPROVED",
      reviewerId: owner.user.id,
    },
  });
  const { p, v } = await prepared(owner);
  const pack = (await payload(await addPack(owner.cookie, p.id, v.id))).data;
  await transition(owner.cookie, p.id, "PUBLISHED");
  await packState(owner.cookie, p.id, pack.id, "ACTIVE");
  const body = {
    packId: pack.id,
    partnerId: partner.id,
    mode: "PRICED",
    unitPriceToman: "1234567",
    validFrom: new Date(Date.now() - 60000).toISOString(),
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    reason: "قیمت کاملاً مصنوعی آزمون",
    requestId: randomUUID(),
  };
  return { owner, reviewer, buyer, partner, p, v, pack, body };
}
async function newOffer(
  f: Awaited<ReturnType<typeof wholesaleFixture>>,
  extra: Record<string, unknown> = {},
) {
  return offersCreate(
    request(
      "/api/admin/products/" + f.p.id + "/offers",
      "POST",
      f.owner.cookie,
      { ...f.body, ...extra },
    ),
    context(f.p.id),
  );
}
async function offerState(
  f: Awaited<ReturnType<typeof wholesaleFixture>>,
  offerId: string,
  status = "PUBLISHED",
  version = 1,
  cookie = f.reviewer.cookie,
) {
  return offersStatus(
    request(
      "/api/admin/products/" + f.p.id + "/offers/" + offerId + "/status",
      "PATCH",
      cookie,
      { status, version, reason: "تصمیم قیمت آزمون مستقل" },
    ),
    { params: Promise.resolve({ id: f.p.id, offerId }) },
  );
}
async function publishedOffer(
  f: Awaited<ReturnType<typeof wholesaleFixture>>,
  extra: Record<string, unknown> = {},
) {
  const response = await newOffer(f, extra);
  expect(response.status).toBe(201);
  const offer = (await payload(response)).data;
  expect((await offerState(f, offer.id)).status).toBe(200);
  return offer;
}

async function retailCartFixture() {
  const owner = await staff(),
    buyer = await customer();
  const { p, v } = await prepared(owner);
  await transition(owner.cookie, p.id, "PUBLISHED");
  await move(owner.cookie, v.id, 20);
  return { owner, buyer, p, v };
}
async function cartAddItem(
  cookie: string,
  itemId: string,
  quantity = 1,
  mode = "RETAIL",
  requestId = randomUUID(),
) {
  return cartAdd(
    request("/api/cart", "POST", cookie, { mode, itemId, quantity, requestId }),
  );
}
async function readBasket(cookie: string, mode = "RETAIL") {
  const response = await cartRead(
    request("/api/cart?mode=" + mode, "GET", cookie),
  );
  expect(response.status).toBe(200);
  return (await payload(response)).data;
}
async function calculate(cookie: string, version: number, mode = "RETAIL") {
  return cartQuote(
    request("/api/cart/quote", "POST", cookie, { mode, version }),
  );
}

async function orderFixture(quantity = 2) {
  const f = await retailCartFixture();
  await cartAddItem(f.buyer.cookie, f.v.id, quantity);
  const basket = await readBasket(f.buyer.cookie);
  const quote = (
    await payload(await calculate(f.buyer.cookie, basket.cart.version))
  ).data;
  return {
    ...f,
    quote,
    basket,
    input: {
      mode: "RETAIL",
      version: basket.cart.version,
      fingerprint: quote.fingerprint,
      requestId: randomUUID(),
    },
  };
}
async function reserve(cookie: string, input: Record<string, unknown>) {
  return reserveOrder(request("/api/orders", "POST", cookie, input));
}
async function cancel(cookie: string, id: string, version = 1) {
  return orderCancel(
    request("/api/orders/" + id + "/cancel", "POST", cookie, { version }),
    { params: Promise.resolve({ id }) },
  );
}
async function expireFixture(id: string) {
  await db().$executeRawUnsafe(
    'ALTER TABLE "PurchaseOrder" DISABLE TRIGGER order_guard',
  );
  try {
    await db().purchaseOrder.update({
      where: { id },
      data: {
        createdAt: new Date(Date.now() - 300000),
        reservedUntil: new Date(Date.now() - 1000),
      },
    });
  } finally {
    await db().$executeRawUnsafe(
      'ALTER TABLE "PurchaseOrder" ENABLE TRIGGER order_guard',
    );
  }
}
beforeEach(async () => {
  await db().$executeRawUnsafe(
    'TRUNCATE "SupportMessage","SupportThread","OrderShipment","TelegramOtp","ManualPayment","TelegramLogin","TelegramUpdate","TelegramOutbox","StoreSettings","ReservationMovement","OrderHold","PurchaseOrder","CartOperation","ServerCartLine","ServerCart","WholesaleOffer","InventoryMovement","PackComponent","PackDefinition"',
  );
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
  // Opt-in synthetic browser fixtures, confined by setup.ts to the isolated kiya_test DB.
  if (process.env.KIYA_EXPORT_WHOLESALE_UI === "true") {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    expect((await move(f.owner.cookie, f.v.id, 30)).status).toBe(201);
    const users: Record<string, unknown> = {
      approved: { cookie: f.buyer.cookie, partnerId: f.partner.id },
      outsider: await customer(),
    };
    for (const status of [
      "PENDING",
      "SUSPENDED",
      "REJECTED",
      "EXPIRED",
      "INQUIRY",
    ]) {
      const user = await customer();
      const app = await db().partnerAccount.create({
        data: {
          userId: user.id,
          businessName: "پرونده مصنوعی " + status,
          city: "شهر آزمون",
          note: "داده مصنوعی آزمون مرورگر",
          status:
            status === "EXPIRED" || status === "INQUIRY" ? "APPROVED" : status,
          reviewerId: status === "PENDING" ? null : f.owner.user.id,
          ...(status === "EXPIRED"
            ? { expiresAt: new Date(Date.now() - 60000) }
            : {}),
        },
      });
      users[status.toLowerCase()] = { cookie: user.cookie, partnerId: app.id };
      if (status === "INQUIRY")
        await publishedOffer(
          { ...f, partner: app, buyer: user },
          {
            mode: "INQUIRY",
            unitPriceToman: null,
            partnerId: app.id,
            requestId: randomUUID(),
          },
        );
    }
    const prefix = "999999123456789";
    const cardDigit = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((i) =>
      validCard(prefix + i),
    );
    await db().storeSettings.create({
      data: {
        telegramEnabled: true,
        botUsername: "kiyaco24bot",
        botTokenEncrypted: encrypt(
          "123456789:" + "SYNTHETIC_TEST_CREDENTIAL_".repeat(2),
        ),
        webhookSecretEncrypted: encrypt(
          "SYNTHETIC_WEBHOOK_TEST_SECRET_NOT_FOR_PRODUCTION",
        ),
        cardEnabled: true,
        bankName: "بانک مصنوعی تست",
        cardNumber: prefix + cardDigit,
        cardHolder: "حساب مصنوعی تست",
        shippingToman: "10000",
        taxToman: "0",
        transferMinutes: 60,
      },
    });
    await db().role.create({
      data: {
        key: "CUSTOM_FINANCE_UI",
        name: "مالی محدود مرورگر",
        permissions: ["payment:review"],
      },
    });
    const finance = await staff("CUSTOM_FINANCE_UI");
    await db().role.create({
      data: {
        key: "CUSTOM_SUPPORT_READER_UI",
        name: "خواندن پشتیبانی مرورگر",
        permissions: ["support:read"],
      },
    });
    const supportReader = await staff("CUSTOM_SUPPORT_READER_UI");
    await mkdir(".data", { recursive: true });
    await writeFile(
      ".data/wholesale-ui-fixture.json",
      JSON.stringify({
        users,
        reviewerCookie: f.reviewer.cookie,
        financeCookie: finance.cookie,
        supportReaderCookie: supportReader.cookie,
        telegramSecret: "SYNTHETIC_WEBHOOK_TEST_SECRET_NOT_FOR_PRODUCTION",
        productId: f.p.id,
        variantId: f.v.id,
        packId: f.pack.id,
        unitPrice: "1234567",
        units: f.pack.unitsPerPack,
      }),
      { mode: 0o600 },
    );
  } else
    await rm(process.cwd() + "/.data/test-media", {
      recursive: true,
      force: true,
    });
  await db().$disconnect();
});
describe("real PostgreSQL backend", () => {
  const syntheticToken = "123456789:" + "SYNTHETIC_TEST_CREDENTIAL_".repeat(2);
  const syntheticSecret = "SYNTHETIC_WEBHOOK_TEST_SECRET_NOT_FOR_PRODUCTION";
  async function configure(
    owner: Awaited<ReturnType<typeof staff>>,
    extra: Record<string, unknown> = {},
  ) {
    const meta = (
      await payload(
        await settingsGet(request("/api/admin/settings", "GET", owner.cookie)),
      )
    ).data;
    const body = {
      version: meta.version,
      telegramEnabled: true,
      botUsername: "kiyaco24bot",
      botToken: syntheticToken,
      webhookSecret: syntheticSecret,
      cardEnabled: false,
      bankName: "",
      cardNumber: "",
      cardHolder: "",
      shippingToman: "10000",
      taxToman: "0",
      transferMinutes: 60,
      ...extra,
    };
    const result = await settingsPut(
      request("/api/admin/settings", "PUT", owner.cookie, body),
    );
    expect(result.status).toBe(200);
    return body;
  }
  function card() {
    const prefix = "999999123456789";
    for (let i = 0; i < 10; i++) if (validCard(prefix + i)) return prefix + i;
    throw Error("synthetic card generation failed");
  }
  async function telegramStart() {
    const r = await telegramAuth(
      request("/api/auth/telegram", "POST", "", { action: "start" }),
    );
    expect(r.status).toBe(201);
    const data = (await payload(r)).data;
    return {
      ...data,
      cookie: cookie(r),
      selector: new URL(data.link).searchParams.get("start")!.slice(6),
    };
  }
  async function bot(
    update: Record<string, unknown>,
    secret = syntheticSecret,
  ) {
    return telegramHook(
      request("/api/webhooks/telegram", "POST", "", update, {
        "x-telegram-bot-api-secret-token": secret,
      }),
    );
  }
  const startUpdate = (selector: string, id = 111001, update_id = 1) => ({
    update_id,
    message: {
      from: { id, first_name: "مشتری مصنوعی" },
      chat: { id, type: "private" },
      text: "/start login_" + selector,
    },
  });
  const confirmUpdate = (selector: string, id = 111001, update_id = 2) => ({
    update_id,
    callback_query: {
      from: { id, first_name: "مشتری مصنوعی" },
      message: { chat: { id, type: "private" } },
      data: "confirm:" + selector,
    },
  });
  it("tests the real-provider adapter with mocked transport without exposing credentials, and configures webhook/polling only for MFA owners", async () => {
    const owner = await staff(),
      support = await staff("SUPPORT");
    await configure(owner);
    const mocked = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ ok: true, result: { username: "kiyaco24bot" } }),
            { headers: { "content-type": "application/json" } },
          ),
      );
    const prior = process.env.NEXT_PUBLIC_SITE_URL;
    try {
      expect(
        (
          await telegramHealth(
            request("/api/admin/settings/telegram", "POST", support.cookie, {
              action: "test",
            }),
          )
        ).status,
      ).toBe(403);
      expect(mocked).not.toHaveBeenCalled();
      const result = await telegramHealth(
        request("/api/admin/settings/telegram", "POST", owner.cookie, {
          action: "test",
        }),
      );
      expect(result.status).toBe(200);
      expect(JSON.stringify(await payload(result))).not.toContain(
        syntheticToken,
      );
      process.env.NEXT_PUBLIC_SITE_URL = "https://store.example.invalid";
      expect(
        (
          await telegramHealth(
            request("/api/admin/settings/telegram", "POST", owner.cookie, {
              action: "webhook",
            }),
          )
        ).status,
      ).toBe(200);
      const webhookCall = mocked.mock.calls.find(([url]) =>
        String(url).endsWith("/setWebhook"),
      );
      expect(webhookCall).toBeTruthy();
      expect(JSON.parse(String(webhookCall![1]!.body))).toMatchObject({
        url: "https://store.example.invalid/api/webhooks/telegram",
        secret_token: syntheticSecret,
        drop_pending_updates: false,
      });
      expect(
        (
          await telegramHealth(
            request("/api/admin/settings/telegram", "POST", owner.cookie, {
              action: "polling",
            }),
          )
        ).status,
      ).toBe(200);
      expect(
        mocked.mock.calls.some(([url]) =>
          String(url).endsWith("/deleteWebhook"),
        ),
      ).toBe(true);
      mocked.mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, result: { username: "different_bot" } }),
        ),
      );
      expect(
        (
          await telegramHealth(
            request("/api/admin/settings/telegram", "POST", owner.cookie, {
              action: "test",
            }),
          )
        ).status,
      ).toBe(409);
      mocked.mockRejectedValue(new Error("synthetic transport failure"));
      const failed = await telegramHealth(
        request("/api/admin/settings/telegram", "POST", owner.cookie, {
          action: "test",
        }),
      );
      expect(failed.status).toBe(503);
      expect(JSON.stringify(await payload(failed))).not.toContain(
        syntheticToken,
      );
    } finally {
      mocked.mockRestore();
      if (prior === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prior;
    }
  });
  it("lets a finance-only custom role review receipts but never read integration secrets or act after revocation", async () => {
    const f = await paymentFixture();
    const p = (await payload(await receiptFor(f))).data;
    await db().role.create({
      data: {
        key: "CUSTOM_FINANCE",
        name: "مالی محدود آزمون",
        permissions: ["payment:review"],
      },
    });
    const finance = await staff("CUSTOM_FINANCE");
    expect(
      (await settingsGet(request("/api/admin/settings", "GET", finance.cookie)))
        .status,
    ).toBe(403);
    expect(
      (await financeList(request("/api/admin/payments", "GET", finance.cookie)))
        .status,
    ).toBe(200);
    expect(
      (
        await receiptGet(
          request("/api/payments/" + p.id + "/receipt", "GET", finance.cookie),
          context(p.id),
        )
      ).status,
    ).toBe(200);
    expect(
      await db().auditLog.count({
        where: { actorId: finance.user.id, action: "payment:receipt_read" },
      }),
    ).toBe(1);
    await db().user.update({
      where: { id: finance.user.id },
      data: { permissionVersion: { increment: 1 } },
    });
    expect(
      (
        await paymentReview(
          request("/api/admin/payments/" + p.id, "POST", finance.cookie, {
            version: p.version,
            decision: "CONFIRM",
            reason: "تطبیق مصنوعی پس از لغو دسترسی که نباید انجام شود",
            bankReconciled: true,
            bankReference: "2026-10-23:SYNTHETIC-BANK-ENTRY-001",
          }),
          context(p.id),
        )
      ).status,
    ).toBe(401);
    expect(
      (await db().manualPayment.findUniqueOrThrow({ where: { id: p.id } }))
        .status,
    ).toBe("UNDER_REVIEW");
  });
  const contactUpdate = (id = 111001, owner = id, update_id = 3) => ({
    update_id,
    message: {
      from: { id },
      chat: { id, type: "private" },
      contact: { user_id: owner, phone_number: "989999999999" },
    },
  });
  async function approvedTelegram(id = 111001) {
    const c = await telegramStart();
    await bot(startUpdate(c.selector, id, 1));
    await bot(confirmUpdate(c.selector, id, 2));
    return c;
  }
  async function finishTelegram(c: { id: string; cookie: string }) {
    const r = await telegramAuth(
      request("/api/auth/telegram", "POST", c.cookie, {
        action: "finish",
        id: c.id,
      }),
    );
    expect(r.status).toBe(200);
    return cookie(r);
  }
  it("verifies only the private sender own contact, never grants ownership when an owner already exists, and never exposes phone in audit", async () => {
    const prior = process.env.KIYA_BOOTSTRAP_OWNER_PHONE;
    process.env.KIYA_BOOTSTRAP_OWNER_PHONE = "09999999999";
    try {
      await configure(await staff());
      const c = await approvedTelegram();
      await bot(contactUpdate(111001, 222002));
      expect(
        (await db().telegramLogin.findUniqueOrThrow({ where: { id: c.id } }))
          .verifiedPhone,
      ).toBeNull();
      await bot(contactUpdate(111001, 111001, 4));
      const signed = await finishTelegram(c);
      const user = (
        await payload(
          await me(request("/api/auth/me", "GET", signed), acontext("me")),
        )
      ).data.user;
      expect(user.kind).toBe("CUSTOMER");
      expect(user.adminAccess).toBe(false);
      const record = await db().user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(record.phone).toBe("+989999999999");
      expect(record.phoneVerifiedAt).not.toBeNull();
      expect(JSON.stringify(await db().auditLog.findMany())).not.toContain(
        "989999999999",
      );
    } finally {
      if (prior === undefined) delete process.env.KIYA_BOOTSTRAP_OWNER_PHONE;
      else process.env.KIYA_BOOTSTRAP_OWNER_PHONE = prior;
    }
  });
  it("pins first-owner bootstrap to an allowed phone AND the configured numeric Telegram ID, rejects malformed config and never trusts ID alone", () => {
    const config = {
      KIYA_BOOTSTRAP_OWNER_PHONES: "09999999999,+989999999998",
      KIYA_BOOTSTRAP_OWNER_TELEGRAM_ID: "111001",
    };
    expect(matchesBootstrapOwner("+989999999999", 111001n, config)).toBe(true);
    expect(matchesBootstrapOwner("+989999999998", 111001n, config)).toBe(true);
    expect(matchesBootstrapOwner("+989999999999", 222002n, config)).toBe(false);
    expect(matchesBootstrapOwner("+989999999997", 111001n, config)).toBe(false);
    expect(matchesBootstrapOwner("+989999999999", null, config)).toBe(false);
    expect(
      matchesBootstrapOwner("+989999999999", 111001n, {
        KIYA_BOOTSTRAP_OWNER_TELEGRAM_ID: "111001",
      }),
    ).toBe(false);
    expect(
      matchesBootstrapOwner("+989999999999", 111001n, {
        ...config,
        KIYA_BOOTSTRAP_OWNER_TELEGRAM_ID: "not-an-id",
      }),
    ).toBe(false);
    expect(
      matchesBootstrapOwner("+989999999999", 111001n, {
        ...config,
        KIYA_BOOTSTRAP_OWNER_PHONES: "09999999999,invalid",
      }),
    ).toBe(false);
    expect(
      matchesBootstrapOwner("+989999999999", 111001n, {
        KIYA_BOOTSTRAP_OWNER_PHONE: "09999999999",
      }),
    ).toBe(true);
  });
  it("bootstraps the first owner only from operator-configured phone and Telegram own-contact proof; keeps same account and requires MFA without a password", async () => {
    const prior = process.env.KIYA_BOOTSTRAP_OWNER_PHONE;
    process.env.KIYA_BOOTSTRAP_OWNER_PHONE = "09999999999";
    try {
      const setupOwner = await staff();
      await configure(setupOwner);
      await db().userRole.deleteMany({ where: { userId: setupOwner.user.id } });
      const c = await approvedTelegram();
      const oldCookie = await finishTelegram(c);
      const before = (
        await payload(
          await me(request("/api/auth/me", "GET", oldCookie), acontext("me")),
        )
      ).data.user;
      expect(before.adminAccess).toBe(false);
      await bot(contactUpdate());
      expect(
        (
          await payload(
            await me(request("/api/auth/me", "GET", oldCookie), acontext("me")),
          )
        ).data.user,
      ).toBeNull();
      const next = await telegramStart();
      await bot(startUpdate(next.selector, 111001, 4));
      await bot(confirmUpdate(next.selector, 111001, 5));
      const signed = await finishTelegram(next);
      const user = (
        await payload(
          await me(request("/api/auth/me", "GET", signed), acontext("me")),
        )
      ).data.user;
      expect(user.id).toBe(before.id);
      expect(user.kind).toBe("STAFF");
      expect(user.adminAccess).toBe(true);
      expect(user.canShop).toBe(true);
      expect(user.permissions).toEqual([]);
      const record = await db().user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(record.passwordHash).toBeNull();
      expect(record.handle).toBeNull();
      expect(
        (await settingsGet(request("/api/admin/settings", "GET", signed)))
          .status,
      ).toBe(403);
      expect(
        (await cartRead(request("/api/cart?mode=RETAIL", "GET", signed)))
          .status,
      ).toBe(200);
      const setup = (
        await payload(
          await auth(
            request("/api/auth/mfa-setup", "POST", signed, {}),
            acontext("mfa-setup"),
          ),
        )
      ).data;
      expect(
        (
          await auth(
            request("/api/auth/mfa-verify", "POST", signed, {
              code: totp(setup.secret),
            }),
            acontext("mfa-verify"),
          )
        ).status,
      ).toBe(200);
      expect(
        (await settingsGet(request("/api/admin/settings", "GET", signed)))
          .status,
      ).toBe(200);
    } finally {
      if (prior === undefined) delete process.env.KIYA_BOOTSTRAP_OWNER_PHONE;
      else process.env.KIYA_BOOTSTRAP_OWNER_PHONE = prior;
    }
  });
  it("promotes an existing verified shopping account with owner-selected role, revokes old sessions and preserves account/order ownership without new username/password", async () => {
    const f = await orderFixture();
    await configure(f.owner);
    await db().user.update({
      where: { id: f.buyer.id },
      data: {
        isDemo: false,
        telegramId: 111001n,
        telegramVerifiedAt: new Date(),
        phone: "+989999999999",
        phoneVerifiedAt: new Date(),
      },
    });
    const order = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    const role = await db().role.findUniqueOrThrow({
      where: { key: "SUPPORT" },
    });
    const input = {
      userId: f.buyer.id,
      roleIds: [role.id],
      reason: "اعطای مستند نقش پشتیبانی به همان حساب کاربری آزمون",
    };
    expect(
      (
        await promote(
          request("/api/admin/staff/promote", "POST", f.buyer.cookie, input),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await promote(
          request("/api/admin/staff/promote", "POST", f.owner.cookie, input),
        )
      ).status,
    ).toBe(200);
    expect(
      (await db().purchaseOrder.findUniqueOrThrow({ where: { id: order.id } }))
        .userId,
    ).toBe(f.buyer.id);
    expect(
      (
        await payload(
          await me(
            request("/api/auth/me", "GET", f.buyer.cookie),
            acontext("me"),
          ),
        )
      ).data.user,
    ).toBeNull();
    const c = await approvedTelegram();
    const signed = await finishTelegram(c);
    const user = (
      await payload(
        await me(request("/api/auth/me", "GET", signed), acontext("me")),
      )
    ).data.user;
    expect(user.id).toBe(f.buyer.id);
    expect(
      (
        await payload(await ordersRead(request("/api/orders", "GET", signed)))
      ).data.orders.some((o: { id: string }) => o.id === order.id),
    ).toBe(true);
    expect(user.adminAccess).toBe(true);
    expect(user.canShop).toBe(true);
    expect(user.mfaVerified).toBe(false);
    expect(
      (await cartRead(request("/api/cart?mode=RETAIL", "GET", signed))).status,
    ).toBe(200);
    expect(
      (await settingsGet(request("/api/admin/settings", "GET", signed))).status,
    ).toBe(403);
    const record = await db().user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(record.passwordHash).toBeNull();
    expect(
      await db().userRole.count({
        where: { userId: user.id, role: { key: "OWNER" } },
      }),
    ).toBe(0);
  });
  it("signs in the direct-link browser after private Start alone, without bot callback or browser confirmation", async () => {
    await configure(await staff());
    const r = await telegramAuth(
      request("/api/auth/telegram", "POST", "", {
        action: "start",
        mode: "direct",
      }),
    );
    expect(r.status).toBe(201);
    const c = (await payload(r)).data,
      cookieValue = cookie(r),
      selector = new URL(c.link).searchParams.get("start")!.slice(6);
    await bot(startUpdate(selector));
    expect(
      (await db().telegramLogin.findUniqueOrThrow({ where: { id: c.id } }))
        .approvedAt,
    ).not.toBeNull();
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", "", {
            action: "finish",
            id: c.id,
          }),
        )
      ).status,
    ).toBe(401);
    const finished = await telegramAuth(
      request("/api/auth/telegram", "POST", cookieValue, {
        action: "finish",
        id: c.id,
      }),
    );
    expect(finished.status).toBe(200);
    expect(
      (
        await payload(
          await me(
            request("/api/auth/me", "GET", cookie(finished)),
            acontext("me"),
          ),
        )
      ).data.user.kind,
    ).toBe("CUSTOMER");
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", cookieValue, {
            action: "finish",
            id: c.id,
          }),
        )
      ).status,
    ).toBe(410);
  });
  async function registeredOtpUser() {
    await configure(await staff());
    await bot({
      update_id: 1,
      message: {
        from: { id: 555001, first_name: "آزمون کد تلگرام" },
        chat: { id: 555001, type: "private" },
        text: "/start",
      },
    });
    expect(
      await db().session.count({ where: { user: { telegramId: 555001n } } }),
    ).toBe(0);
    await bot({
      update_id: 2,
      message: {
        from: { id: 555001 },
        chat: { id: 555001, type: "private" },
        contact: { user_id: 555001, phone_number: "989999999999" },
      },
    });
    return db().user.findUniqueOrThrow({ where: { telegramId: 555001n } });
  }
  async function otpChallenge(phone = "09999999999") {
    const r = await telegramAuth(
      request("/api/auth/telegram", "POST", "", { action: "otp-start", phone }),
    );
    expect(r.status).toBe(201);
    const p = (await payload(r)).data;
    expect(p).not.toHaveProperty("code");
    return { ...p, cookie: cookie(r) };
  }
  async function deliveredOtp() {
    const out = await db().telegramOutbox.findFirstOrThrow({
      where: {
        chatId: 555001n,
        text: { startsWith: "otp-encrypted:" },
      },
      orderBy: { createdAt: "desc" },
    });
    return decrypt(out.text.slice(14)).match(/: (\d{6})/)![1];
  }
  it("delivers an OTP only to a previously started own-contact verified Telegram account and consumes once in the requesting browser", async () => {
    const user = await registeredOtpUser();
    expect(user.phoneVerifiedAt).not.toBeNull();
    const c = await otpChallenge(),
      code = await deliveredOtp();
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", "", {
            action: "otp-verify",
            id: c.id,
            code,
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", c.cookie, {
            action: "otp-verify",
            id: c.id,
            code: "000000",
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (await db().telegramOtp.findUniqueOrThrow({ where: { id: c.id } }))
        .attempts,
    ).toBe(1);
    const result = await Promise.all(
      [1, 2].map(() =>
        telegramAuth(
          request("/api/auth/telegram", "POST", c.cookie, {
            action: "otp-verify",
            id: c.id,
            code: code.replace(/\d/g, (n) => "۰۱۲۳۴۵۶۷۸۹"[Number(n)]),
          }),
        ),
      ),
    );
    expect(result.map((r) => r.status).sort()).toEqual([200, 410]);
    const signed = cookie(result.find((r) => r.status === 200)!);
    expect(
      (
        await payload(
          await me(request("/api/auth/me", "GET", signed), acontext("me")),
        )
      ).data.user.id,
    ).toBe(user.id);
    expect(await db().session.count({ where: { userId: user.id } })).toBe(1);
  });
  it("uses generic OTP requests for unknown phones, locks after five wrong codes and enforces expiry", async () => {
    await registeredOtpUser();
    const count = await db().telegramOutbox.count(),
      unknown = await otpChallenge("09999999998");
    expect(await db().telegramOutbox.count()).toBe(count);
    for (let i = 0; i < 5; i++)
      expect(
        (
          await telegramAuth(
            request("/api/auth/telegram", "POST", unknown.cookie, {
              action: "otp-verify",
              id: unknown.id,
              code: "000000",
            }),
          )
        ).status,
      ).toBe(422);
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", unknown.cookie, {
            action: "otp-verify",
            id: unknown.id,
            code: "000000",
          }),
        )
      ).status,
    ).toBe(410);
    const c = await otpChallenge();
    await db().telegramOtp.update({
      where: { id: c.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", c.cookie, {
            action: "otp-verify",
            id: c.id,
            code: await deliveredOtp(),
          }),
        )
      ).status,
    ).toBe(410);
  });
  it("protects write-only encrypted integration secrets with owner/MFA, versioning and sanitized audit", async () => {
    const owner = await staff(),
      support = await staff("SUPPORT"),
      pending = await staff("OWNER", false);
    expect((await settingsGet(request("/api/admin/settings"))).status).toBe(
      401,
    );
    expect(
      (await settingsGet(request("/api/admin/settings", "GET", support.cookie)))
        .status,
    ).toBe(403);
    expect(
      (await settingsGet(request("/api/admin/settings", "GET", pending.cookie)))
        .status,
    ).toBe(403);
    const body = await configure(owner);
    const meta = await payload(
      await settingsGet(request("/api/admin/settings", "GET", owner.cookie)),
    );
    expect(meta.data.botTokenConfigured).toBe(true);
    expect(JSON.stringify(meta)).not.toContain(syntheticToken);
    expect(JSON.stringify(meta)).not.toContain(syntheticSecret);
    const stored = await db().storeSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    expect(stored.botTokenEncrypted).not.toContain(syntheticToken);
    expect(decrypt(stored.botTokenEncrypted!)).toBe(syntheticToken);
    expect(
      (
        await settingsPut(
          request("/api/admin/settings", "PUT", owner.cookie, body),
        )
      ).status,
    ).toBe(409);
    expect(JSON.stringify(await db().auditLog.findMany())).not.toContain(
      syntheticToken,
    );
  });
  it("binds Telegram login to browser and private Telegram user, deduplicates updates and consumes once without granting staff or phone verification", async () => {
    await configure(await staff());
    const c = await telegramStart();
    expect(c.link).toMatch(/^https:\/\/t.me\/kiyaco24bot\?start=login_/);
    expect((await bot(startUpdate(c.selector), "incorrect")).status).toBe(403);
    expect(await db().telegramUpdate.count()).toBe(0);
    await bot(confirmUpdate(c.selector, 222002, 1));
    expect(
      (await db().telegramLogin.findUniqueOrThrow({ where: { id: c.id } }))
        .approvedAt,
    ).toBeNull();
    await bot(startUpdate(c.selector, 111001, 2));
    await bot(confirmUpdate(c.selector, 222002, 3));
    expect(
      (await db().telegramLogin.findUniqueOrThrow({ where: { id: c.id } }))
        .approvedAt,
    ).toBeNull();
    await bot(confirmUpdate(c.selector, 111001, 4));
    const count = await db().telegramOutbox.count();
    await bot(confirmUpdate(c.selector, 111001, 4));
    expect(await db().telegramOutbox.count()).toBe(count);
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", "", {
            action: "finish",
            id: c.id,
          }),
        )
      ).status,
    ).toBe(401);
    const responses = await Promise.all(
      [1, 2].map(() =>
        telegramAuth(
          request("/api/auth/telegram", "POST", c.cookie, {
            action: "finish",
            id: c.id,
          }),
        ),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 410]);
    const signed = responses.find((r) => r.status === 200)!;
    const who = (
      await payload(
        await me(
          request("/api/auth/me", "GET", cookie(signed)),
          acontext("me"),
        ),
      )
    ).data.user;
    expect(who.kind).toBe("CUSTOMER");
    expect(who.permissions).toEqual([]);
    const user = await db().user.findUniqueOrThrow({ where: { id: who.id } });
    expect(user.phoneVerifiedAt).toBeNull();
    expect(user.telegramVerifiedAt).not.toBeNull();
    expect(user.isDemo).toBe(false);
    expect(await db().session.count({ where: { userId: user.id } })).toBe(1);
    process.env.APP_MODE = "live";
    try {
      expect(
        (
          await apply(
            request("/api/partner", "POST", cookie(signed), {
              businessName: "فروشگاه آزمون تلگرام",
              city: "شهر آزمون",
              note: "درخواست مصنوعی بدون تأیید خودکار همکاری",
            }),
          )
        ).status,
      ).toBe(201);
    } finally {
      process.env.APP_MODE = "demo";
    }
  });
  it("expires and disables Telegram challenges and rejects group/bot impersonation", async () => {
    const owner = await staff();
    await configure(owner);
    const c = await telegramStart();
    await bot({
      update_id: 1,
      message: {
        from: { id: 111001 },
        chat: { id: 111001, type: "group" },
        text: "/start login_" + c.selector,
      },
    });
    expect(
      (await db().telegramLogin.findUniqueOrThrow({ where: { id: c.id } }))
        .telegramId,
    ).toBeNull();
    await db().telegramLogin.update({
      where: { id: c.id },
      data: {
        createdAt: new Date(Date.now() - 300000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", c.cookie, {
            action: "finish",
            id: c.id,
          }),
        )
      ).status,
    ).toBe(410);
    await configure(owner, { telegramEnabled: false });
    expect(
      (
        await telegramAuth(
          request("/api/auth/telegram", "POST", "", { action: "start" }),
        )
      ).status,
    ).toBe(503);
  });
  async function paymentFixture() {
    const f = await orderFixture();
    await configure(f.owner, {
      cardEnabled: true,
      bankName: "بانک مصنوعی تست",
      cardNumber: card(),
      cardHolder: "حساب مصنوعی تست",
    });
    const order = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    const body = {
      orderId: order.id,
      recipient: "گیرنده مصنوعی",
      phone: "09999999999",
      city: "شهر آزمون",
      address: "نشانی مصنوعی فقط برای تست نرم‌افزار",
      postalCode: "9999999999",
    };
    const response = await manualCreate(
      request("/api/payments", "POST", f.buyer.cookie, body),
    );
    expect(response.status).toBe(200);
    return { ...f, order, payment: (await payload(response)).data, body };
  }
  async function receiptFor(
    f: Awaited<ReturnType<typeof paymentFixture>>,
    bytes?: Buffer,
  ) {
    const form = new FormData();
    form.set("version", String(f.payment.version));
    form.set("reference", "SYNTHETIC-BANK-REFERENCE");
    const image =
      bytes ||
      (await sharp({
        create: { width: 300, height: 300, channels: 3, background: "#8a32a0" },
      })
        .png()
        .toBuffer());
    form.set(
      "file",
      new Blob([new Uint8Array(image)], { type: "image/png" }),
      "synthetic.png",
    );
    return receiptPost(
      new Request(origin + "/api/payments/" + f.payment.id + "/receipt", {
        method: "POST",
        headers: { origin, Cookie: f.buyer.cookie },
        body: form,
      }),
      context(f.payment.id),
    );
  }
  it("freezes server money, destination/address and extends a live hold idempotently; clients cannot set the amount", async () => {
    const f = await paymentFixture();
    expect(f.payment.amountToman).toBe(
      (BigInt(f.order.subtotalToman) + 10000n).toString(),
    );
    expect(
      (
        await manualCreate(
          request("/api/payments", "POST", f.buyer.cookie, {
            ...f.body,
            amountToman: "1",
          }),
        )
      ).status,
    ).toBe(422);
    const again = (
      await payload(
        await manualCreate(
          request("/api/payments", "POST", f.buyer.cookie, f.body),
        ),
      )
    ).data;
    expect(again.id).toBe(f.payment.id);
    expect(await db().manualPayment.count()).toBe(1);
    const ord = await db().purchaseOrder.findUniqueOrThrow({
      where: { id: f.order.id },
    });
    expect(ord.reservedUntil.getTime()).toBeGreaterThan(
      Date.now() + 50 * 60000,
    );
    await expect(
      db().manualPayment.update({
        where: { id: f.payment.id },
        data: { amountToman: "1", version: { increment: 1 } },
      }),
    ).rejects.toThrow();
    const other = await customer();
    expect(
      (
        await manualGet(
          request("/api/payments?orderId=" + f.order.id, "GET", other.cookie),
        )
      ).status,
    ).toBe(404);
  });

  async function supportFixture() {
    const buyer = await customer(),
      owner = await staff();
    const body = {
      requestId: randomUUID(),
      subject: "درخواست خصوصی آزمون",
      body: "پیام خصوصی مشتری برای آزمون نرم‌افزار",
    };
    const created = await supportCreateApi(
      request("/api/support", "POST", buyer.cookie, body),
    );
    expect(created.status).toBe(201);
    return { buyer, owner, input: body, thread: (await payload(created)).data };
  }
  const supportPath = (id: string, admin = false) =>
    "/api/" + (admin ? "admin/" : "") + "support/" + id;
  it("requires an authenticated customer and scoped MFA staff for private support", async () => {
    expect((await supportListApi(request("/api/support"))).status).toBe(401);
    const f = await supportFixture(),
      plain = await staff("SUPPORT"),
      pending = await staff("OWNER", false);
    expect(
      (
        await staffSupportList(
          request("/api/admin/support", "GET", f.buyer.cookie),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await staffSupportList(
          request("/api/admin/support", "GET", plain.cookie),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await staffSupportList(
          request("/api/admin/support", "GET", pending.cookie),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await supportCreateApi(
          request("/api/support", "POST", f.buyer.cookie, f.input, {
            Origin: "https://evil.test",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await staffSupportList(
          request("/api/admin/support", "GET", f.owner.cookie),
        )
      ).status,
    ).toBe(200);
  });
  it("creates a support conversation exactly once under retries and rejects body collisions", async () => {
    const c = await customer(),
      input = {
        requestId: randomUUID(),
        subject: "سؤال خصوصی",
        body: "پیام یکسان برای آزمون هم‌زمانی",
      };
    const results = await Promise.all(
      [1, 2].map(() =>
        supportCreateApi(request("/api/support", "POST", c.cookie, input)),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(await db().supportThread.count()).toBe(1);
    expect(await db().supportMessage.count()).toBe(1);
    expect(
      (
        await supportCreateApi(
          request("/api/support", "POST", c.cookie, {
            ...input,
            body: "متن تغییر یافته",
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await supportCreateApi(
          request("/api/support", "POST", c.cookie, {
            ...input,
            requestId: randomUUID(),
            internal: true,
          }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await supportCreateApi(
          request("/api/support", "POST", c.cookie, {
            ...input,
            requestId: randomUUID(),
            body: "bad\u0000control",
          }),
        )
      ).status,
    ).toBe(422);
  });
  it("never exposes another customer's private thread or messages", async () => {
    const f = await supportFixture(),
      other = await customer(),
      path = supportPath(f.thread.id);
    expect(
      (
        await supportReadApi(
          request(path, "GET", other.cookie),
          context(f.thread.id),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await supportMessageApi(
          request(path, "POST", other.cookie, {
            requestId: randomUUID(),
            body: "دسترسی غیرمجاز",
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await supportStatusApi(
          request(path, "PATCH", other.cookie, {
            status: "CLOSED",
            version: 1,
            reason: "تلاش غیرمجاز",
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await payload(
          await supportListApi(request("/api/support", "GET", other.cookie)),
        )
      ).data.items,
    ).toEqual([]);
  });
  it("keeps staff notes absent from customer bodies, cursors, versions and public activity timestamps", async () => {
    const f = await supportFixture(),
      path = supportPath(f.thread.id),
      staffPath = supportPath(f.thread.id, true);
    const before = (
      await payload(
        await supportReadApi(
          request(path, "GET", f.buyer.cookie),
          context(f.thread.id),
        ),
      )
    ).data;
    const note = await staffSupportMessage(
      request(staffPath, "POST", f.owner.cookie, {
        requestId: randomUUID(),
        body: "INTERNAL-CANARY-DO-NOT-EXPOSE",
        internal: true,
      }),
      context(f.thread.id),
    );
    expect(note.status).toBe(201);
    const noteId = (await payload(note)).data.id;
    const after = (
      await payload(
        await supportReadApi(
          request(path, "GET", f.buyer.cookie),
          context(f.thread.id),
        ),
      )
    ).data;
    expect(after).toEqual(before);
    expect(
      JSON.stringify(
        (
          await payload(
            await supportListApi(
              request("/api/support", "GET", f.buyer.cookie),
            ),
          )
        ).data,
      ),
    ).not.toContain("INTERNAL-CANARY");
    expect(
      (
        await supportReadApi(
          request(path + "?before=" + noteId, "GET", f.buyer.cookie),
          context(f.thread.id),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await supportReadApi(
          request(path + "?internal=true", "GET", f.buyer.cookie),
          context(f.thread.id),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await supportMessageApi(
          request(path, "POST", f.buyer.cookie, {
            requestId: randomUUID(),
            body: "customer note",
            internal: true,
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(403);
    expect(
      JSON.stringify(
        (
          await payload(
            await staffSupportRead(
              request(staffPath, "GET", f.owner.cookie),
              context(f.thread.id),
            ),
          )
        ).data,
      ),
    ).toContain("INTERNAL-CANARY");
  });
  it("allows public staff replies without granting internal note access or status management", async () => {
    const f = await supportFixture(),
      role = await db().role.create({
        data: {
          key: "CUSTOM_SUPPORT_REPLY",
          name: "پاسخ خصوصی",
          permissions: ["support:read", "support:reply"],
        },
      }),
      agent = await staff(role.key),
      path = supportPath(f.thread.id, true);
    await staffSupportMessage(
      request(path, "POST", f.owner.cookie, {
        requestId: randomUUID(),
        body: "INTERNAL-HIDDEN-NOTE",
        internal: true,
      }),
      context(f.thread.id),
    );
    expect(
      JSON.stringify(
        (
          await payload(
            await staffSupportRead(
              request(path, "GET", agent.cookie),
              context(f.thread.id),
            ),
          )
        ).data,
      ),
    ).not.toContain("INTERNAL-HIDDEN");
    const reply = await staffSupportMessage(
      request(path, "POST", agent.cookie, {
        requestId: randomUUID(),
        body: "پاسخ عمومی واقعی در سایت",
      }),
      context(f.thread.id),
    );
    expect(reply.status).toBe(201);
    expect(
      (
        await staffSupportMessage(
          request(path, "POST", agent.cookie, {
            requestId: randomUUID(),
            body: "یادداشت غیرمجاز",
            internal: true,
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await staffSupportStatus(
          request(path, "PATCH", agent.cookie, {
            status: "CLOSED",
            version: 2,
            reason: "نباید مجاز باشد",
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(403);
    const response = await supportReadApi(
      request(supportPath(f.thread.id), "GET", f.buyer.cookie),
      context(f.thread.id),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const data = (await payload(response)).data;
    expect(data.messages.at(-1).authorKind).toBe("STAFF");
    expect(JSON.stringify(data)).not.toMatch(
      /authorId|digest|requestId|telegramId|passwordHash/,
    );
  });
  it("idempotently appends messages and rejects reusing a message key in another thread", async () => {
    const f = await supportFixture(),
      path = supportPath(f.thread.id),
      input = { requestId: randomUUID(), body: "UNIQUE-MESSAGE-REPLAY" };
    const results = await Promise.all(
      [1, 2].map(() =>
        supportMessageApi(
          request(path, "POST", f.buyer.cookie, input),
          context(f.thread.id),
        ),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(await db().supportMessage.count()).toBe(2);
    expect(
      (
        await db().supportThread.findUniqueOrThrow({
          where: { id: f.thread.id },
        })
      ).version,
    ).toBe(2);
    expect(
      (
        await supportMessageApi(
          request(path, "POST", f.buyer.cookie, {
            ...input,
            body: "different body",
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(409);
    const second = (
      await payload(
        await supportCreateApi(
          request("/api/support", "POST", f.buyer.cookie, {
            ...f.input,
            requestId: randomUUID(),
          }),
        ),
      )
    ).data;
    expect(
      (
        await supportMessageApi(
          request(supportPath(second.id), "POST", f.buyer.cookie, input),
          context(second.id),
        )
      ).status,
    ).toBe(409);
    const crossKey = randomUUID();
    const crossThread = await Promise.all(
      [f.thread.id, second.id].map((id) =>
        supportMessageApi(
          request(supportPath(id), "POST", f.buyer.cookie, {
            requestId: crossKey,
            body: "متن آزمون رقابت دو گفت‌وگو",
          }),
          context(id),
        ),
      ),
    );
    expect(crossThread.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await db().supportMessage.count({
        where: { authorId: f.buyer.id, requestId: crossKey },
      }),
    ).toBe(1);
    expect(JSON.stringify(await db().auditLog.findMany())).not.toContain(
      "UNIQUE-MESSAGE-REPLAY",
    );
  });
  it("serializes close/reopen and prevents public replies on closed threads while allowing private notes", async () => {
    const f = await supportFixture(),
      path = supportPath(f.thread.id),
      input = { status: "CLOSED", version: 1, reason: "موضوع بررسی و بسته شد" };
    const closed = await Promise.all(
      [1, 2].map(() =>
        supportStatusApi(
          request(path, "PATCH", f.buyer.cookie, input),
          context(f.thread.id),
        ),
      ),
    );
    expect(closed.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (
        await supportMessageApi(
          request(path, "POST", f.buyer.cookie, {
            requestId: randomUUID(),
            body: "پیام در ترد بسته",
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await staffSupportMessage(
          request(supportPath(f.thread.id, true), "POST", f.owner.cookie, {
            requestId: randomUUID(),
            body: "یادداشت داخلی پس از بستن",
            internal: true,
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await supportStatusApi(
          request(path, "PATCH", f.buyer.cookie, {
            status: "OPEN",
            version: 2,
            reason: "نیاز به بررسی دوباره",
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await supportMessageApi(
          request(path, "POST", f.buyer.cookie, {
            requestId: randomUUID(),
            body: "پیام پس از بازکردن",
          }),
          context(f.thread.id),
        )
      ).status,
    ).toBe(201);
  });
  it("paginates only public history without leaking note cursor IDs", async () => {
    const f = await supportFixture(),
      path = supportPath(f.thread.id);
    await db().supportMessage.createMany({
      data: Array.from({ length: 53 }, (_, index) => ({
        threadId: f.thread.id,
        authorId: f.buyer.id,
        authorKind: "CUSTOMER",
        requestId: randomUUID(),
        digest: hash("history-" + index),
        body: "پیام قبلی " + index,
        createdAt: new Date(Date.now() - 60000 + index * 10),
      })),
    });
    const latest = (
      await payload(
        await supportReadApi(
          request(path, "GET", f.buyer.cookie),
          context(f.thread.id),
        ),
      )
    ).data;
    expect(latest.messages).toHaveLength(50);
    expect(latest.hasMore).toBe(true);
    const older = (
      await payload(
        await supportReadApi(
          request(
            path + "?before=" + latest.messages[0].id,
            "GET",
            f.buyer.cookie,
          ),
          context(f.thread.id),
        ),
      )
    ).data;
    expect(older.messages).toHaveLength(4);
    expect(older.hasMore).toBe(false);
    expect(
      new Set([...older.messages, ...latest.messages].map((m) => m.id)).size,
    ).toBe(54);
  });
  it("links only owned orders and preserves message and thread identities in the database", async () => {
    const f = await orderFixture(),
      order = (await payload(await reserve(f.buyer.cookie, f.input))).data,
      other = await customer(),
      input = {
        requestId: randomUUID(),
        subject: "پیگیری سفارش",
        body: "درخواست پیگیری سفارش خودم",
        orderId: order.id,
      };
    expect(
      (
        await supportCreateApi(
          request("/api/support", "POST", other.cookie, input),
        )
      ).status,
    ).toBe(404);
    const response = await supportCreateApi(
      request("/api/support", "POST", f.buyer.cookie, input),
    );
    expect(response.status).toBe(201);
    const thread = (await payload(response)).data,
      message = await db().supportMessage.findFirstOrThrow({
        where: { threadId: thread.id },
      });
    await expect(
      db().supportMessage.update({
        where: { id: message.id },
        data: { body: "rewrite history" },
      }),
    ).rejects.toThrow();
    await expect(
      db().supportMessage.delete({ where: { id: message.id } }),
    ).rejects.toThrow();
    await expect(
      db().supportThread.update({
        where: { id: thread.id },
        data: { userId: other.id, version: 2 },
      }),
    ).rejects.toThrow();
    await expect(
      db().supportMessage.create({
        data: {
          threadId: thread.id,
          authorId: other.id,
          authorKind: "CUSTOMER",
          requestId: randomUUID(),
          digest: hash("forged"),
          body: "forged author",
        },
      }),
    ).rejects.toThrow();
  });
  it("bounds open conversations and reauthorizes suspended sessions on every read", async () => {
    const f = await supportFixture();
    await db().supportThread.createMany({
      data: Array.from({ length: 9 }, (_, i) => ({
        userId: f.buyer.id,
        requestId: randomUUID(),
        digest: hash("cap-" + i),
        subject: "درخواست باز " + i,
      })),
    });
    expect(
      (
        await supportCreateApi(
          request("/api/support", "POST", f.buyer.cookie, {
            ...f.input,
            requestId: randomUUID(),
          }),
        )
      ).status,
    ).toBe(409);
    await db().user.update({
      where: { id: f.buyer.id },
      data: { isActive: false },
    });
    expect(
      (
        await supportReadApi(
          request(supportPath(f.thread.id), "GET", f.buyer.cookie),
          context(f.thread.id),
        )
      ).status,
    ).toBe(401);
  });
  async function paidFulfillmentFixture() {
    const f = await paymentFixture();
    const receipt = (await payload(await receiptFor(f))).data;
    const result = await paymentReview(
      request("/api/admin/payments/" + f.payment.id, "POST", f.owner.cookie, {
        version: receipt.version,
        decision: "CONFIRM",
        reason: "تطبیق مصنوعی بانک برای آزمون ارسال سفارش",
        bankReconciled: true,
        bankReference: "SHIPMENT-SYNTHETIC-" + randomUUID(),
      }),
      context(f.payment.id),
    );
    expect(result.status).toBe(200);
    return f;
  }
  const fulfillmentReason = "عملیات مستند مصنوعی فقط برای آزمون نرم‌افزار";
  async function fulfillmentAction(
    f: Awaited<ReturnType<typeof paymentFixture>>,
    action: string,
    version: number,
    extra = {},
  ) {
    return fulfill(
      request("/api/admin/orders/" + f.order.id, "POST", f.owner.cookie, {
        action,
        version,
        reason: fulfillmentReason,
        ...extra,
      }),
      context(f.order.id),
    );
  }
  it("requires staff order permission, MFA and same-origin for fulfillment", async () => {
    const f = await paymentFixture(),
      support = await staff("SUPPORT"),
      pending = await staff("OWNER", false);
    for (const [c, code] of [
      ["", 401],
      [f.buyer.cookie, 403],
      [support.cookie, 403],
      [pending.cookie, 403],
    ] as const) {
      expect(
        (await fulfillmentList(request("/api/admin/orders", "GET", c))).status,
      ).toBe(code);
      expect(
        (
          await fulfill(
            request("/api/admin/orders/" + f.order.id, "POST", c, {
              action: "prepare",
              version: 0,
              reason: fulfillmentReason,
            }),
            context(f.order.id),
          )
        ).status,
      ).toBe(code);
    }
    expect(
      (
        await fulfill(
          request(
            "/api/admin/orders/" + f.order.id,
            "POST",
            f.owner.cookie,
            { action: "prepare", version: 0, reason: fulfillmentReason },
            { Origin: "https://evil.test" },
          ),
          context(f.order.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await fulfillmentList(
          request("/api/admin/orders?page=0", "GET", f.owner.cookie),
        )
      ).status,
    ).toBe(422);
  });
  it("forbids dispatch of unpaid orders in API and database", async () => {
    const f = await paymentFixture();
    expect((await fulfillmentAction(f, "prepare", 0)).status).toBe(409);
    await expect(
      db().orderShipment.create({ data: { orderId: f.order.id } }),
    ).rejects.toThrow();
    expect(
      (
        await payload(
          await fulfillmentList(
            request("/api/admin/orders", "GET", f.owner.cookie),
          ),
        )
      ).data.items,
    ).toHaveLength(0);
  });
  it("fulfills a confirmed order sequentially without changing captured stock or financial status", async () => {
    const f = await paidFulfillmentFixture(),
      stock = await db().productVariant.findUniqueOrThrow({
        where: { id: f.v.id },
      }),
      movements = await db().inventoryMovement.count();
    expect((await fulfillmentAction(f, "deliver", 0)).status).toBe(422);
    expect(
      (
        await fulfillmentAction(f, "ship", 1, {
          carrier: "پست آزمون",
          trackingCode: "TRACK-001",
        })
      ).status,
    ).toBe(409);
    expect((await fulfillmentAction(f, "prepare", 0)).status).toBe(200);
    expect((await fulfillmentAction(f, "deliver", 1)).status).toBe(409);
    expect(
      (
        await fulfillmentAction(f, "ship", 1, {
          carrier: "پست آزمون",
          trackingCode: "https://unsafe.test",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await fulfillmentAction(f, "ship", 1, {
          carrier: "پست آزمون",
          trackingCode: "TRACK-001",
        })
      ).status,
    ).toBe(200);
    expect((await fulfillmentAction(f, "deliver", 2)).status).toBe(200);
    const shipment = await db().orderShipment.findUniqueOrThrow({
      where: { orderId: f.order.id },
    });
    expect(shipment.status).toBe("DELIVERED");
    expect(shipment.version).toBe(3);
    expect(shipment.deliveredAt).not.toBeNull();
    expect(
      (
        await db().purchaseOrder.findUniqueOrThrow({
          where: { id: f.order.id },
        })
      ).status,
    ).toBe("PAID");
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .stock,
    ).toBe(stock.stock);
    expect(await db().inventoryMovement.count()).toBe(movements);
    expect(
      await db().auditLog.count({
        where: {
          resourceId: f.order.id,
          action: { in: ["order:prepare", "order:ship", "order:deliver"] },
        },
      }),
    ).toBe(3);
  });
  it("serializes duplicate preparation and dispatch and rejects stale versions", async () => {
    const f = await paidFulfillmentFixture();
    const prepared = await Promise.all(
      [1, 2].map(() => fulfillmentAction(f, "prepare", 0)),
    );
    expect(prepared.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db().orderShipment.count()).toBe(1);
    const dispatched = await Promise.all(
      [1, 2].map(() =>
        fulfillmentAction(f, "ship", 1, {
          carrier: "پست آزمون",
          trackingCode: "TRACK-002",
        }),
      ),
    );
    expect(dispatched.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await fulfillmentAction(f, "deliver", 1)).status).toBe(409);
  });
  it("shows only the customer's own tracking and filters the private fulfillment queue", async () => {
    const f = await paidFulfillmentFixture(),
      other = await customer();
    await fulfillmentAction(f, "prepare", 0);
    await fulfillmentAction(f, "ship", 1, {
      carrier: "پست آزمون",
      trackingCode: "TRACK-PRIVATE",
    });
    const own = (
      await payload(
        await ordersRead(request("/api/orders", "GET", f.buyer.cookie)),
      )
    ).data.orders;
    expect(own[0].shipment.trackingCode).toBe("TRACK-PRIVATE");
    expect(
      JSON.stringify(
        (
          await payload(
            await ordersRead(request("/api/orders", "GET", other.cookie)),
          )
        ).data,
      ),
    ).not.toContain("TRACK-PRIVATE");
    const listed = await fulfillmentList(
      request("/api/admin/orders?status=SHIPPED", "GET", f.owner.cookie),
    );
    expect(listed.headers.get("cache-control")).toBe("private, no-store");
    const data = (await payload(listed)).data;
    expect(data.items).toHaveLength(1);
    expect(data.canManage).toBe(true);
    expect(data.items[0].shippingAddress.postalCode).toBe(f.body.postalCode);
    expect(JSON.stringify(data)).not.toMatch(
      /bankVerifiedReference|passwordHash|imageHash|telegramId/,
    );
    expect(
      (
        await payload(
          await fulfillmentList(
            request(
              "/api/admin/orders?status=UNSTARTED",
              "GET",
              f.owner.cookie,
            ),
          ),
        )
      ).data.items,
    ).toHaveLength(0);
  });
  it("supports a read-only custom shipping role without payment review or mutation permission", async () => {
    const f = await paidFulfillmentFixture();
    const role = await db().role.create({
        data: {
          key: "CUSTOM_SHIPPING_READER",
          name: "مشاهده ارسال",
          permissions: ["order:read"],
        },
      }),
      reader = await staff(role.key);
    expect(
      (
        await payload(
          await fulfillmentList(
            request("/api/admin/orders", "GET", reader.cookie),
          ),
        )
      ).data.canManage,
    ).toBe(false);
    expect(
      (
        await fulfill(
          request("/api/admin/orders/" + f.order.id, "POST", reader.cookie, {
            action: "prepare",
            version: 0,
            reason: fulfillmentReason,
          }),
          context(f.order.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (await financeList(request("/api/admin/payments", "GET", reader.cookie)))
        .status,
    ).toBe(403);
  });
  it("guards shipment history against direct SQL state skipping, deletion and rewriting dispatch evidence", async () => {
    const f = await paidFulfillmentFixture();
    await fulfillmentAction(f, "prepare", 0);
    await expect(
      db().orderShipment.update({
        where: { orderId: f.order.id },
        data: { status: "DELIVERED", version: 2 },
      }),
    ).rejects.toThrow();
    await expect(
      db().orderShipment.delete({ where: { orderId: f.order.id } }),
    ).rejects.toThrow();
    await fulfillmentAction(f, "ship", 1, {
      carrier: "پست آزمون",
      trackingCode: "TRACK-003",
    });
    await expect(
      db().orderShipment.update({
        where: { orderId: f.order.id },
        data: {
          status: "DELIVERED",
          version: 3,
          trackingCode: "REWRITTEN",
          deliveredAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    await expect(
      db().orderShipment.update({
        where: { orderId: f.order.id },
        data: { status: "DELIVERED", version: 3 },
      }),
    ).rejects.toThrow();
    await fulfillmentAction(f, "deliver", 2);
    expect((await fulfillmentAction(f, "deliver", 3)).status).toBe(409);
  });
  it("keeps receipts private and never treats an uploaded screenshot as paid; independently confirms exactly once with atomic stock and ledgers", async () => {
    const f = await paymentFixture(),
      support = await staff("SUPPORT");
    const submitted = await receiptFor(f);
    expect(submitted.status).toBe(200);
    const p = (await payload(submitted)).data;
    expect(p.status).toBe("UNDER_REVIEW");
    expect(
      (
        await db().purchaseOrder.findUniqueOrThrow({
          where: { id: f.order.id },
        })
      ).status,
    ).toBe("RESERVED");
    expect(
      (
        await receiptGet(
          request("/api/payments/" + p.id + "/receipt"),
          context(p.id),
        )
      ).status,
    ).toBe(401);
    const other = await customer();
    expect(
      (
        await receiptGet(
          request("/api/payments/" + p.id + "/receipt", "GET", other.cookie),
          context(p.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await receiptGet(
          request("/api/payments/" + p.id + "/receipt", "GET", f.buyer.cookie),
          context(p.id),
        )
      ).headers.get("cache-control"),
    ).toBe("private, no-store");
    const body = {
      version: p.version,
      decision: "CONFIRM",
      reason: "تطبیق مصنوعی گردش بانک در آزمون، نه واریز واقعی",
      bankReconciled: true,
      bankReference: "2026-10-23:SYNTHETIC-BANK-ENTRY-001",
    };
    expect(
      (
        await paymentReview(
          request("/api/admin/payments/" + p.id, "POST", support.cookie, body),
          context(p.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await paymentReview(
          request("/api/admin/payments/" + p.id, "POST", f.owner.cookie, {
            ...body,
            bankReconciled: false,
          }),
          context(p.id),
        )
      ).status,
    ).toBe(422);
    const results = await Promise.all(
      [1, 2].map(() =>
        paymentReview(
          request("/api/admin/payments/" + p.id, "POST", f.owner.cookie, body),
          context(p.id),
        ),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (
        await db().purchaseOrder.findUniqueOrThrow({
          where: { id: f.order.id },
        })
      ).status,
    ).toBe("PAID");
    const variant = await db().productVariant.findUniqueOrThrow({
      where: { id: f.v.id },
    });
    expect(variant.stock).toBe(18);
    expect(variant.reserved).toBe(0);
    expect(
      await db().inventoryMovement.count({
        where: { variantId: f.v.id, delta: -2 },
      }),
    ).toBe(1);
    expect((await cancel(f.buyer.cookie, f.order.id, 3)).status).toBe(200);
    expect(
      (
        await db().purchaseOrder.findUniqueOrThrow({
          where: { id: f.order.id },
        })
      ).status,
    ).toBe("PAID");
  });
  it("never attributes the same verified bank-statement entry to two payments even with a different screenshot", async () => {
    const first = await paymentFixture();
    const p = (await payload(await receiptFor(first))).data;
    const evidence = {
      version: p.version,
      decision: "CONFIRM",
      reason: "تطبیق مصنوعی ردیف یکتای گردش بانک برای جلوگیری از مصرف دوباره",
      bankReconciled: true,
      bankReference: "2026-10-23:SYNTHETIC-UNIQUE-ENTRY-99",
    };
    expect(
      (
        await paymentReview(
          request("/api/admin/payments/" + p.id, "POST", first.owner.cookie, {
            ...evidence,
            bankReference: undefined,
          }),
          context(p.id),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await paymentReview(
          request(
            "/api/admin/payments/" + p.id,
            "POST",
            first.owner.cookie,
            evidence,
          ),
          context(p.id),
        )
      ).status,
    ).toBe(200);
    const second = await paymentFixture();
    const bytes = await sharp({
      create: { width: 300, height: 300, channels: 3, background: "#112266" },
    })
      .png()
      .toBuffer();
    const q = (await payload(await receiptFor(second, bytes))).data;
    expect(
      (
        await paymentReview(
          request("/api/admin/payments/" + q.id, "POST", second.owner.cookie, {
            ...evidence,
            version: q.version,
            bankReference: evidence.bankReference.toLowerCase(),
          }),
          context(q.id),
        )
      ).status,
    ).toBe(409);
    expect(
      (await db().manualPayment.findUniqueOrThrow({ where: { id: q.id } }))
        .status,
    ).toBe("UNDER_REVIEW");
    expect(
      (
        await db().productVariant.findUniqueOrThrow({
          where: { id: second.v.id },
        })
      ).stock,
    ).toBe(20);
  });
  it("does not capture late bank funds against expired inventory and flags manual refund review", async () => {
    const f = await paymentFixture();
    const p = (await payload(await receiptFor(f))).data;
    await expireFixture(f.order.id);
    await releaseExpiredOrders();
    const result = await paymentReview(
      request("/api/admin/payments/" + p.id, "POST", f.owner.cookie, {
        version: p.version,
        decision: "CONFIRM",
        reason: "تطبیق مصنوعی پس از پایان مهلت رزرو و نیاز استرداد",
        bankReconciled: true,
        bankReference: "2026-10-23:SYNTHETIC-BANK-ENTRY-001",
      }),
      context(p.id),
    );
    expect(result.status).toBe(200);
    expect((await payload(result)).data.status).toBe("REFUND_REQUIRED");
    await expect(
      db().manualPayment.update({
        where: { id: p.id },
        data: { status: "AWAITING_TRANSFER", version: { increment: 1 } },
      }),
    ).rejects.toThrow();
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .stock,
    ).toBe(20);
    expect(
      (
        await db().purchaseOrder.findUniqueOrThrow({
          where: { id: f.order.id },
        })
      ).status,
    ).toBe("EXPIRED");
  });
  it("limits partner status to the authenticated customer and never returns private pricing", async () => {
    expect((await partnerMe(request("/api/partner"))).status).toBe(401);
    const a = await customer(),
      b = await customer(),
      owner = await staff();
    expect(
      (await partnerMe(request("/api/partner", "GET", owner.cookie))).status,
    ).toBe(403);
    expect(
      (
        await apply(
          request("/api/partner", "POST", a.cookie, {
            businessName: "فروشگاه مصنوعی",
            city: "شهر آزمون",
            note: "توضیح همکاری مصنوعی",
          }),
        )
      ).status,
    ).toBe(201);
    const response = await partnerMe(request("/api/partner", "GET", a.cookie));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    const data = (await payload(response)).data;
    expect(data.application.status).toBe("PENDING");
    expect(data.application.businessName).toBe("فروشگاه مصنوعی");
    expect(data.minPacks).toBe(1);
    expect(data.minAmountToman).toBe("0");
    expect(JSON.stringify(data)).not.toMatch(
      /unitPriceToman|packPriceToman|passwordHash|reviewerId|phone/,
    );
    expect(
      (await payload(await partnerMe(request("/api/partner", "GET", b.cookie))))
        .data.application,
    ).toBeNull();
  });
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
  it("requires staff MFA for pack reads and separate permissions for BOM writes", async () => {
    const owner = await staff(),
      content = await staff("CONTENT");
    const { p, v } = await newSku(owner);
    expect(
      (
        await packsRead(
          request("/api/admin/products/" + p.id + "/packs"),
          context(p.id),
        )
      ).status,
    ).toBe(401);
    expect((await addPack(content.cookie, p.id, v.id)).status).toBe(403);
    expect(
      (
        await packsRead(
          request(
            "/api/admin/products/" + p.id + "/packs",
            "GET",
            content.cookie,
          ),
          context(p.id),
        )
      ).status,
    ).toBe(200);
  });
  it("stores a real non-twelve BOM without inventing stock or a wholesale price", async () => {
    const owner = await staff();
    const { p, v } = await newSku(owner);
    const response = await addPack(owner.cookie, p.id, v.id, 7);
    expect(response.status).toBe(201);
    const data = (await payload(response)).data;
    expect(data.unitsPerPack).toBe(7);
    expect(data.components[0].units).toBe(7);
    expect(data.status).toBe("DRAFT");
    expect(JSON.stringify(data)).not.toMatch(
      /"stock"|"reserved"|"wholesalePrice"/,
    );
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: v.id } }))
        .stock,
    ).toBe(0);
    expect(await db().inventoryMovement.count()).toBe(0);
    expect(
      await db().auditLog.count({ where: { action: "pack:create" } }),
    ).toBe(1);
  });
  it("rejects duplicate colors, zero/fractional units, unsupported mode and excessive totals", async () => {
    const owner = await staff();
    const { p, v } = await newSku(owner);
    for (const body of [
      { ...packBody(v.id), components: [{ variantId: v.id, units: 0 }] },
      { ...packBody(v.id), components: [{ variantId: v.id, units: 1.5 }] },
      { ...packBody(v.id), components: [{ variantId: v.id, units: 10001 }] },
      { ...packBody(v.id), mode: "MIX_AND_MATCH" },
      {
        ...packBody(v.id),
        mode: "FIXED_ASSORTMENT",
        components: [
          { variantId: v.id, units: 1 },
          { variantId: v.id.toUpperCase(), units: 2 },
        ],
      },
    ])
      expect(
        (
          await packsCreate(
            request(
              "/api/admin/products/" + p.id + "/packs",
              "POST",
              owner.cookie,
              body,
            ),
            context(p.id),
          )
        ).status,
      ).toBe(422);
    expect(await db().packDefinition.count()).toBe(0);
  });
  it("rejects foreign-product and inactive components in both service and FK constraints", async () => {
    const owner = await staff();
    const { p, v } = await newSku(owner);
    const other = await newSku(owner);
    expect((await addPack(owner.cookie, p.id, other.v.id)).status).toBe(422);
    await db().productVariant.update({
      where: { id: v.id },
      data: { isActive: false },
    });
    expect((await addPack(owner.cookie, p.id, v.id)).status).toBe(422);
    const pack = await db().packDefinition.create({
      data: {
        productId: p.id,
        label: "پیش نویس تست",
        mode: "HOMOGENEOUS",
        unitsPerPack: 1,
      },
    });
    await expect(
      db().packComponent.create({
        data: {
          packId: pack.id,
          productId: p.id,
          variantId: other.v.id,
          units: 1,
        },
      }),
    ).rejects.toThrow();
  });
  it("edits only current draft versions and serializes competing BOM writes", async () => {
    const owner = await staff();
    const { p, v } = await newSku(owner);
    const pack = (await payload(await addPack(owner.cookie, p.id, v.id))).data;
    const edit = () =>
      packsEdit(
        request(
          "/api/admin/products/" + p.id + "/packs/" + pack.id,
          "PUT",
          owner.cookie,
          { ...packBody(v.id, 5), version: 1 },
        ),
        packContext(p.id, pack.id),
      );
    const results = await Promise.all([edit(), edit()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const updated = await db().packDefinition.findUniqueOrThrow({
      where: { id: pack.id },
      include: { components: true },
    });
    expect(updated.unitsPerPack).toBe(5);
    expect(updated.version).toBe(2);
    expect(updated.components).toHaveLength(1);
  });
  it("requires published product and pack-publish permission before activation", async () => {
    const owner = await staff(),
      content = await staff("CONTENT");
    const { p, v } = await newSku(owner);
    const pack = (await payload(await addPack(owner.cookie, p.id, v.id))).data;
    expect(
      (await packState(owner.cookie, p.id, pack.id, "ACTIVE")).status,
    ).toBe(409);
    expect(
      (await packState(content.cookie, p.id, pack.id, "ACTIVE")).status,
    ).toBe(403);
    expect(
      (await db().packDefinition.findUniqueOrThrow({ where: { id: pack.id } }))
        .status,
    ).toBe("DRAFT");
  });
  it("activates valid BOMs and prevents active definition/component mutation at DB level", async () => {
    const owner = await staff();
    const { p, v } = await prepared(owner);
    const pack = (await payload(await addPack(owner.cookie, p.id, v.id, 4)))
      .data;
    expect((await transition(owner.cookie, p.id, "PUBLISHED")).status).toBe(
      200,
    );
    expect(
      (await packState(owner.cookie, p.id, pack.id, "ACTIVE")).status,
    ).toBe(200);
    expect(
      (
        await packsEdit(
          request(
            "/api/admin/products/" + p.id + "/packs/" + pack.id,
            "PUT",
            owner.cookie,
            { ...packBody(v.id), version: 2 },
          ),
          packContext(p.id, pack.id),
        )
      ).status,
    ).toBe(409);
    await expect(
      db().packDefinition.update({
        where: { id: pack.id },
        data: { label: "دستکاری" },
      }),
    ).rejects.toThrow();
    await expect(
      db().packComponent.update({
        where: { packId_variantId: { packId: pack.id, variantId: v.id } },
        data: { units: 9 },
      }),
    ).rejects.toThrow();
    await expect(
      db().productVariant.update({
        where: { id: v.id },
        data: { isActive: false },
      }),
    ).rejects.toThrow();
  });
  it("requires archiving referenced packs before changing a SKU and never reactivates archived BOMs", async () => {
    const owner = await staff();
    const { p, v } = await prepared(owner);
    const pack = (await payload(await addPack(owner.cookie, p.id, v.id))).data;
    await transition(owner.cookie, p.id, "PUBLISHED");
    await packState(owner.cookie, p.id, pack.id, "ACTIVE");
    await transition(owner.cookie, p.id, "ARCHIVED");
    await transition(owner.cookie, p.id, "DRAFT");
    const edit = () =>
      variantEditApi(
        request(
          "/api/admin/products/" + p.id + "/variants/" + v.id,
          "PATCH",
          owner.cookie,
          { name: "رنگ جدید", hex: "#112233", isActive: true, version: 1 },
        ),
        { params: Promise.resolve({ id: p.id, variantId: v.id }) },
      );
    expect((await edit()).status).toBe(409);
    expect(
      (await packState(owner.cookie, p.id, pack.id, "ARCHIVED", 1)).status,
    ).toBe(409);
    expect(
      (await packState(owner.cookie, p.id, pack.id, "ARCHIVED", 2)).status,
    ).toBe(200);
    expect((await edit()).status).toBe(200);
    expect(
      (await packState(owner.cookie, p.id, pack.id, "ACTIVE", 3)).status,
    ).toBe(409);
  });
  it("rejects incomplete active BOMs at transaction commit in PostgreSQL", async () => {
    const owner = await staff();
    const { p } = await newSku(owner);
    await expect(
      db().packDefinition.create({
        data: {
          productId: p.id,
          label: "ترکیب ناقص",
          mode: "FIXED_ASSORTMENT",
          unitsPerPack: 6,
          status: "ACTIVE",
        },
      }),
    ).rejects.toThrow();
    expect(await db().packDefinition.count()).toBe(0);
  });
  it("supports a fixed mixed-color BOM and rejects multi-SKU homogeneous packs", async () => {
    const owner = await staff();
    const { p, v } = await prepared(owner);
    const second = (
      await payload(
        await variantApi(
          request(
            "/api/admin/products/" + p.id + "/variants",
            "POST",
            owner.cookie,
            {
              name: "مشکی",
              hex: "#111111",
              sku: "PACK-" + randomUUID().slice(0, 8),
            },
          ),
          context(p.id),
        ),
      )
    ).data;
    const body = {
      label: "ترکیب پنج تایی",
      mode: "FIXED_ASSORTMENT",
      components: [
        { variantId: v.id, units: 3 },
        { variantId: second.id, units: 2 },
      ],
    };
    expect(
      (
        await packsCreate(
          request(
            "/api/admin/products/" + p.id + "/packs",
            "POST",
            owner.cookie,
            { ...body, mode: "HOMOGENEOUS" },
          ),
          context(p.id),
        )
      ).status,
    ).toBe(422);
    const result = await packsCreate(
      request(
        "/api/admin/products/" + p.id + "/packs",
        "POST",
        owner.cookie,
        body,
      ),
      context(p.id),
    );
    expect(result.status).toBe(201);
    const pack = (await payload(result)).data;
    expect(pack.unitsPerPack).toBe(5);
    expect(pack.components).toHaveLength(2);
    await transition(owner.cookie, p.id, "PUBLISHED");
    expect(
      (await packState(owner.cookie, p.id, pack.id, "ACTIVE")).status,
    ).toBe(200);
  });
  it("publishes a partner-scoped exact wholesale price only after independent approval", async () => {
    const f = await wholesaleFixture();
    const offer = (await payload(await newOffer(f))).data;
    expect(
      (
        await payload(
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          ),
        )
      ).data.items,
    ).toHaveLength(0);
    expect((await offerState(f, offer.id)).status).toBe(200);
    const response = await wholesaleRead(
      request("/api/wholesale/catalog", "GET", f.buyer.cookie),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    const data = (await payload(response)).data;
    expect(data.minPacks).toBe(1);
    expect(data.orderReady).toBe(false);
    expect(data.items[0].unitPriceToman).toBe("1234567");
    expect(data.items[0].packPriceToman).toBe("7407402");
    expect(JSON.stringify(data)).not.toMatch(
      /"stock"|"reserved"|"sku"|"createdBy"|"partnerId"/,
    );
  });
  it("never leaks private wholesale prices to anonymous, staff, other partners or public DTOs", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    expect(
      (await wholesaleRead(request("/api/wholesale/catalog"))).status,
    ).toBe(401);
    expect(
      (
        await wholesaleRead(
          request("/api/wholesale/catalog", "GET", f.owner.cookie),
        )
      ).status,
    ).toBe(403);
    const other = await customer();
    expect(
      (
        await wholesaleRead(
          request("/api/wholesale/catalog", "GET", other.cookie),
        )
      ).status,
    ).toBe(403);
    await db().partnerAccount.create({
      data: {
        userId: other.id,
        businessName: "همکار دیگر",
        city: "تهران",
        note: "داده تست",
        status: "APPROVED",
      },
    });
    const otherResponse = await wholesaleRead(
      request(
        "/api/wholesale/catalog?partnerId=" + f.partner.id,
        "GET",
        other.cookie,
      ),
    );
    expect((await payload(otherResponse)).data.items).toHaveLength(0);
    expect(
      JSON.stringify((await payload(await catalogApi())).data),
    ).not.toContain("1234567");
    expect(JSON.stringify(await publicProduct(f.p.id))).not.toContain(
      "1234567",
    );
  });
  it("denies suspended, rejected and pending partners on every private price read", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    for (const status of ["SUSPENDED", "REJECTED", "PENDING"]) {
      await db().partnerAccount.update({
        where: { id: f.partner.id },
        data: { status },
      });
      const response = await wholesaleRead(
        request("/api/wholesale/catalog", "GET", f.buyer.cookie),
      );
      expect(response.status).toBe(403);
      expect(JSON.stringify(await payload(response))).not.toContain("1234567");
    }
  });
  it("enforces partner expiration and audited optimistic validity renewal", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    const change = (expiresAt: string | null, version: number) =>
      validityApi(
        request(
          "/api/admin/partners/" + f.partner.id + "/validity",
          "PUT",
          f.owner.cookie,
          { expiresAt, version, reason: "تنظیم اعتبار همکار آزمون" },
        ),
        context(f.partner.id),
      );
    expect(
      (await change(new Date(Date.now() - 1000).toISOString(), 1)).status,
    ).toBe(200);
    expect(
      (
        await wholesaleRead(
          request("/api/wholesale/catalog", "GET", f.buyer.cookie),
        )
      ).status,
    ).toBe(403);
    expect((await change(null, 1)).status).toBe(409);
    expect((await change(null, 2)).status).toBe(200);
    expect(
      (
        await payload(
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          ),
        )
      ).data.items,
    ).toHaveLength(1);
  });
  it("prevents price self-approval even by an owner and at the database constraint", async () => {
    const f = await wholesaleFixture();
    const offer = (await payload(await newOffer(f))).data;
    expect(
      (await offerState(f, offer.id, "PUBLISHED", 1, f.owner.cookie)).status,
    ).toBe(403);
    await expect(
      db().wholesaleOffer.update({
        where: { id: offer.id },
        data: {
          status: "PUBLISHED",
          reviewerId: f.owner.user.id,
          version: { increment: 1 },
        },
      }),
    ).rejects.toThrow();
    expect(
      await db().auditLog.count({
        where: { action: "wholesale:price:status" },
      }),
    ).toBe(0);
  });
  it("makes parallel price-creation retries idempotent and rejects key payload collisions", async () => {
    const f = await wholesaleFixture();
    const [a, b] = await Promise.all([newOffer(f), newOffer(f)]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect((await payload(a)).data.id).toBe((await payload(b)).data.id);
    expect(await db().wholesaleOffer.count()).toBe(1);
    expect(
      await db().auditLog.count({
        where: { action: "wholesale:price:create" },
      }),
    ).toBe(1);
    expect((await newOffer(f, { unitPriceToman: "9876543" })).status).toBe(409);
  });
  it("separates wholesale price permissions from ordinary product visibility and MFA", async () => {
    const f = await wholesaleFixture(),
      content = await staff("CONTENT"),
      pending = await staff("OWNER", false);
    const offer = (await payload(await newOffer(f))).data;
    expect(
      (
        await offersRead(
          request(
            "/api/admin/products/" + f.p.id + "/offers",
            "GET",
            content.cookie,
          ),
          context(f.p.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await offersCreate(
          request(
            "/api/admin/products/" + f.p.id + "/offers",
            "POST",
            content.cookie,
            f.body,
          ),
          context(f.p.id),
        )
      ).status,
    ).toBe(403);
    expect(
      (await offerState(f, offer.id, "PUBLISHED", 1, content.cookie)).status,
    ).toBe(403);
    expect(
      (
        await offersRead(
          request(
            "/api/admin/products/" + f.p.id + "/offers",
            "GET",
            pending.cookie,
          ),
          context(f.p.id),
        )
      ).status,
    ).toBe(403);
    expect(
      JSON.stringify(
        (
          await payload(
            await admin(request("/api/admin/products", "GET", content.cookie), {
              params: Promise.resolve({ module: "products" }),
            }),
          )
        ).data,
      ),
    ).not.toContain("1234567");
  });
  it("enforces one published price per partner/pack and immutable archive-replacement history", async () => {
    const f = await wholesaleFixture();
    const first = await publishedOffer(f);
    const second = (
      await payload(
        await newOffer(f, {
          requestId: randomUUID(),
          unitPriceToman: "7654321",
        }),
      )
    ).data;
    expect((await offerState(f, second.id)).status).toBe(409);
    await expect(
      db().wholesaleOffer.update({
        where: { id: first.id },
        data: { unitPriceToman: "1", version: { increment: 1 } },
      }),
    ).rejects.toThrow();
    await expect(
      db().wholesaleOffer.delete({ where: { id: first.id } }),
    ).rejects.toThrow();
    expect((await offerState(f, first.id, "ARCHIVED", 2)).status).toBe(200);
    expect((await offerState(f, second.id)).status).toBe(200);
    expect((await offerState(f, first.id, "PUBLISHED", 3)).status).toBe(409);
    expect(
      (
        await payload(
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          ),
        )
      ).data.items[0].unitPriceToman,
    ).toBe("7654321");
  });
  it("returns inquiry without wholesale numeric fields, never a zero-price fallback", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f, { mode: "INQUIRY", unitPriceToman: null });
    const item = (
      await payload(
        await wholesaleRead(
          request("/api/wholesale/catalog", "GET", f.buyer.cookie),
        ),
      )
    ).data.items[0];
    expect(item.pricing).toBe("INQUIRY");
    expect(item).not.toHaveProperty("unitPriceToman");
    expect(item).not.toHaveProperty("packPriceToman");
    expect(
      (
        await newOffer(f, {
          requestId: randomUUID(),
          mode: "INQUIRY",
          unitPriceToman: "1",
        })
      ).status,
    ).toBe(422);
  });
  it("rejects invalid money, injected status, expired ranges and pack-price overflow", async () => {
    const f = await wholesaleFixture();
    for (const extra of [
      { unitPriceToman: "0" },
      { unitPriceToman: "1.25" },
      { unitPriceToman: 25 },
      { status: "PUBLISHED" },
      { unitPriceToman: "99999999999999" },
      { validUntil: new Date(Date.now() - 100000).toISOString() },
    ])
      expect(
        (await newOffer(f, { requestId: randomUUID(), ...extra })).status,
      ).toBe(422);
    expect(await db().wholesaleOffer.count()).toBe(0);
  });
  it("hides scheduled and expired prices and never falls back to another partner offer", async () => {
    const f = await wholesaleFixture();
    const offer = await publishedOffer(f, {
      validFrom: new Date(Date.now() + 60000).toISOString(),
    });
    expect(
      (
        await payload(
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          ),
        )
      ).data.items,
    ).toHaveLength(0);
    await offerState(f, offer.id, "ARCHIVED", 2);
    await db().wholesaleOffer.create({
      data: {
        productId: f.p.id,
        packId: f.pack.id,
        partnerId: f.partner.id,
        packVersion: 2,
        mode: "PRICED",
        unitPriceToman: "1111111",
        validFrom: new Date(Date.now() - 120000),
        validUntil: new Date(Date.now() - 60000),
        status: "PUBLISHED",
        createdBy: f.owner.user.id,
        reviewerId: f.reviewer.user.id,
        reason: "قیمت منقضی تست",
        requestId: randomUUID(),
      },
    });
    expect(
      (
        await payload(
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          ),
        )
      ).data.items,
    ).toHaveLength(0);
  });
  it("rechecks product and pack publication and refuses stale BOM prices", async () => {
    const f = await wholesaleFixture();
    const offer = await publishedOffer(f);
    await transition(f.owner.cookie, f.p.id, "ARCHIVED");
    expect(
      (
        await payload(
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          ),
        )
      ).data.items,
    ).toHaveLength(0);
    await transition(f.owner.cookie, f.p.id, "DRAFT");
    await transition(f.owner.cookie, f.p.id, "PUBLISHED");
    const draft = (
      await payload(await newOffer(f, { requestId: randomUUID() }))
    ).data;
    await packState(f.owner.cookie, f.p.id, f.pack.id, "ARCHIVED", 2);
    expect(
      (
        await payload(
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          ),
        )
      ).data.items,
    ).toHaveLength(0);
    expect((await offerState(f, draft.id)).status).toBe(409);
    expect(offer.id).toBeTruthy();
  });
  it("requires real customer phone verification in live mode and rejects demo sessions", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    process.env.APP_MODE = "live";
    try {
      expect(
        (
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          )
        ).status,
      ).toBe(401);
      await db().user.update({
        where: { id: f.buyer.id },
        data: { isDemo: false },
      });
      expect(
        (
          await wholesaleRead(
            request("/api/wholesale/catalog", "GET", f.buyer.cookie),
          )
        ).status,
      ).toBe(403);
      await db().user.update({
        where: { id: f.buyer.id },
        data: { phoneVerifiedAt: new Date() },
      });
      expect(
        (
          await payload(
            await wholesaleRead(
              request("/api/wholesale/catalog", "GET", f.buyer.cookie),
            ),
          )
        ).data.items,
      ).toHaveLength(1);
    } finally {
      process.env.APP_MODE = "demo";
    }
  });
  it("serializes concurrent independent price approvals without duplicate audit events", async () => {
    const f = await wholesaleFixture();
    const offer = (await payload(await newOffer(f))).data;
    const results = await Promise.all([
      offerState(f, offer.id),
      offerState(f, offer.id),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await db().auditLog.count({
        where: { action: "wholesale:price:status" },
      }),
    ).toBe(1);
    expect(
      (await db().wholesaleOffer.findUniqueOrThrow({ where: { id: offer.id } }))
        .version,
    ).toBe(2);
  });
  it("requires customer identity and rejects staff, unverified customers and demo products in server carts", async () => {
    const f = await retailCartFixture();
    expect((await cartAddItem("", f.v.id)).status).toBe(401);
    expect((await cartAddItem(f.owner.cookie, f.v.id)).status).toBe(403);
    const sample = await db().productVariant.findFirstOrThrow({
      where: { productId: "everyday-bag" },
    });
    expect((await cartAddItem(f.buyer.cookie, sample.id)).status).toBe(409);
    await db().user.update({
      where: { id: f.buyer.id },
      data: { isDemo: false },
    });
    expect((await cartAddItem(f.buyer.cookie, f.v.id)).status).toBe(403);
    expect(await db().serverCart.count()).toBe(0);
  });
  it("idempotently merges parallel cart additions once and rejects mutation-key collisions", async () => {
    const f = await retailCartFixture(),
      key = randomUUID();
    const [a, b] = await Promise.all([
      cartAddItem(f.buyer.cookie, f.v.id, 2, "RETAIL", key),
      cartAddItem(f.buyer.cookie, f.v.id, 2, "RETAIL", key),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((await payload(a)).data).toEqual((await payload(b)).data);
    expect((await readBasket(f.buyer.cookie)).lines[0].quantity).toBe(2);
    expect(await db().cartOperation.count()).toBe(1);
    expect(
      (await cartAddItem(f.buyer.cookie, f.v.id, 3, "RETAIL", key)).status,
    ).toBe(409);
    expect((await cartAddItem(f.buyer.cookie, f.v.id)).status).toBe(200);
    expect((await readBasket(f.buyer.cookie)).lines[0].quantity).toBe(3);
  });
  it("keeps retail and wholesale baskets separate without accepting client-supplied money", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    await move(f.owner.cookie, f.v.id, 30);
    expect((await cartAddItem(f.buyer.cookie, f.v.id, 2)).status).toBe(200);
    expect(
      (await cartAddItem(f.buyer.cookie, f.pack.id, 1, "WHOLESALE")).status,
    ).toBe(200);
    const retail = await readBasket(f.buyer.cookie),
      wholesale = await readBasket(f.buyer.cookie, "WHOLESALE");
    expect(retail.cart.id).not.toBe(wholesale.cart.id);
    expect(retail.lines).toHaveLength(1);
    expect(wholesale.lines).toHaveLength(1);
    expect(retail.lines[0].quantity).toBe(2);
    expect(wholesale.lines[0].quantity).toBe(1);
    expect(JSON.stringify(wholesale)).not.toContain("1234567");
    expect(
      (
        await cartAdd(
          request("/api/cart", "POST", f.buyer.cookie, {
            mode: "RETAIL",
            itemId: f.v.id,
            quantity: 1,
            requestId: randomUUID(),
            price: "1",
          }),
        )
      ).status,
    ).toBe(422);
  });
  it("calculates retail totals from current server prices without reserving stock or creating a payment amount", async () => {
    const f = await retailCartFixture();
    await cartAddItem(f.buyer.cookie, f.v.id, 2);
    const cart = await readBasket(f.buyer.cookie);
    const response = await calculate(f.buyer.cookie, cart.cart.version);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const quote = (await payload(response)).data;
    expect(quote.subtotalToman).toBe("500000");
    expect(quote.payableToman).toBeNull();
    expect(quote.shippingToman).toBeNull();
    expect(quote.taxToman).toBeNull();
    expect(quote.reserved).toBe(false);
    expect(quote.requiresRevalidation).toBe(true);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(0);
    expect((await readBasket(f.buyer.cookie)).cart.version).toBe(
      cart.cart.version,
    );
    expect(await db().inventoryMovement.count()).toBe(1);
  });
  it("calculates exact wholesale BOM totals and bounds quote expiry by partner validity", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    await move(f.owner.cookie, f.v.id, 30);
    const expiresAt = new Date(Date.now() + 60000);
    await db().partnerAccount.update({
      where: { id: f.partner.id },
      data: { expiresAt },
    });
    await cartAddItem(f.buyer.cookie, f.pack.id, 2, "WHOLESALE");
    const cart = await readBasket(f.buyer.cookie, "WHOLESALE");
    const response = await calculate(
      f.buyer.cookie,
      cart.cart.version,
      "WHOLESALE",
    );
    expect(response.status).toBe(200);
    const quote = (await payload(response)).data;
    expect(quote.subtotalToman).toBe("14814804");
    expect(quote.lines[0].totalUnits).toBe(12);
    expect(quote.lines[0].unitsPerSelection).toBe(6);
    expect(new Date(quote.validUntil).getTime()).toBe(expiresAt.getTime());
    expect(quote.minSelections).toBe(1);
    expect(JSON.stringify(quote)).not.toMatch(/"stock"|"reserved":\d|"sku"/);
  });
  it("aggregates shared SKU demand across distinct packs before checking wholesale stock", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    await move(f.owner.cookie, f.v.id, 10);
    await transition(f.owner.cookie, f.p.id, "ARCHIVED");
    await transition(f.owner.cookie, f.p.id, "DRAFT");
    const second = (
      await payload(await addPack(f.owner.cookie, f.p.id, f.v.id))
    ).data;
    await transition(f.owner.cookie, f.p.id, "PUBLISHED");
    await packState(f.owner.cookie, f.p.id, second.id, "ACTIVE");
    await publishedOffer(f, { packId: second.id, requestId: randomUUID() });
    await cartAddItem(f.buyer.cookie, f.pack.id, 1, "WHOLESALE");
    await cartAddItem(f.buyer.cookie, second.id, 1, "WHOLESALE");
    const cart = await readBasket(f.buyer.cookie, "WHOLESALE");
    const response = await calculate(
      f.buyer.cookie,
      cart.cart.version,
      "WHOLESALE",
    );
    expect(response.status).toBe(409);
    expect((await payload(response)).error.code).toBe("INSUFFICIENT_STOCK");
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(0);
  });
  it("enforces cart ownership and optimistic quantity changes", async () => {
    const f = await retailCartFixture();
    await cartAddItem(f.buyer.cookie, f.v.id);
    const other = await customer();
    await cartAddItem(other.cookie, f.v.id);
    const own = await readBasket(f.buyer.cookie),
      foreign = await readBasket(other.cookie);
    const edit = (lineId: string, version: number, quantity: number) =>
      cartSet(
        request("/api/cart", "PATCH", f.buyer.cookie, {
          mode: "RETAIL",
          lineId,
          version,
          quantity,
          requestId: randomUUID(),
        }),
      );
    expect((await edit(foreign.lines[0].id, own.cart.version, 4)).status).toBe(
      404,
    );
    expect((await edit(own.lines[0].id, own.cart.version, 4)).status).toBe(200);
    expect((await edit(own.lines[0].id, own.cart.version, 5)).status).toBe(409);
    expect((await readBasket(f.buyer.cookie)).lines[0].quantity).toBe(4);
  });
  it("lets a suspended partner remove cart intent but denies price calculation without leaking old prices", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    await cartAddItem(f.buyer.cookie, f.pack.id, 1, "WHOLESALE");
    const cart = await readBasket(f.buyer.cookie, "WHOLESALE");
    await db().partnerAccount.update({
      where: { id: f.partner.id },
      data: { status: "SUSPENDED" },
    });
    const response = await calculate(
      f.buyer.cookie,
      cart.cart.version,
      "WHOLESALE",
    );
    expect(response.status).toBe(403);
    expect(JSON.stringify(await payload(response))).not.toContain("1234567");
    expect(
      (
        await cartSet(
          request("/api/cart", "PATCH", f.buyer.cookie, {
            mode: "WHOLESALE",
            lineId: cart.lines[0].id,
            version: cart.cart.version,
            quantity: 0,
            requestId: randomUUID(),
          }),
        )
      ).status,
    ).toBe(200);
    expect((await readBasket(f.buyer.cookie, "WHOLESALE")).lines).toHaveLength(
      0,
    );
  });
  it("recomputes a changed retail price instead of trusting a previous displayed quote", async () => {
    const f = await retailCartFixture();
    await cartAddItem(f.buyer.cookie, f.v.id, 2);
    const cart = await readBasket(f.buyer.cookie);
    expect(
      (await payload(await calculate(f.buyer.cookie, cart.cart.version))).data
        .subtotalToman,
    ).toBe("500000");
    await transition(f.owner.cookie, f.p.id, "ARCHIVED");
    await transition(f.owner.cookie, f.p.id, "DRAFT");
    const product = await db().product.findUniqueOrThrow({
      where: { id: f.p.id },
    });
    expect(
      (
        await editProduct(
          request("/api/admin/products/" + f.p.id, "PATCH", f.owner.cookie, {
            name: product.name,
            price: "333333",
            version: product.version,
          }),
          context(f.p.id),
        )
      ).status,
    ).toBe(200);
    await transition(f.owner.cookie, f.p.id, "PUBLISHED");
    expect(
      (await payload(await calculate(f.buyer.cookie, cart.cart.version))).data
        .subtotalToman,
    ).toBe("666666");
  });
  it("rechecks physical availability and rejects stale cart versions on quote", async () => {
    const f = await retailCartFixture();
    await cartAddItem(f.buyer.cookie, f.v.id, 2);
    const cart = await readBasket(f.buyer.cookie);
    expect(
      (await calculate(f.buyer.cookie, cart.cart.version - 1)).status,
    ).toBe(409);
    await move(f.owner.cookie, f.v.id, -19, 2);
    expect((await calculate(f.buyer.cookie, cart.cart.version)).status).toBe(
      409,
    );
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .stock,
    ).toBe(1);
  });
  it("requires a current own priced offer at calculation time and never accepts inquiry as free", async () => {
    const f = await wholesaleFixture();
    const offer = await publishedOffer(f);
    await move(f.owner.cookie, f.v.id, 20);
    await cartAddItem(f.buyer.cookie, f.pack.id, 1, "WHOLESALE");
    const cart = await readBasket(f.buyer.cookie, "WHOLESALE");
    await offerState(f, offer.id, "ARCHIVED", 2);
    const missing = await calculate(
      f.buyer.cookie,
      cart.cart.version,
      "WHOLESALE",
    );
    expect(missing.status).toBe(409);
    expect(JSON.stringify(await payload(missing))).not.toContain("1234567");
    await publishedOffer(f, {
      requestId: randomUUID(),
      mode: "INQUIRY",
      unitPriceToman: null,
    });
    expect(
      (await calculate(f.buyer.cookie, cart.cart.version, "WHOLESALE")).status,
    ).toBe(409);
    expect(
      (await cartAddItem(f.buyer.cookie, f.pack.id, 1, "WHOLESALE")).status,
    ).toBe(409);
  });
  it("does not pretend independent quotes reserve shared inventory", async () => {
    const f = await retailCartFixture(),
      other = await customer();
    await cartAddItem(f.buyer.cookie, f.v.id, 15);
    await cartAddItem(other.cookie, f.v.id, 15);
    const a = await readBasket(f.buyer.cookie),
      b = await readBasket(other.cookie);
    const results = await Promise.all([
      calculate(f.buyer.cookie, a.cart.version),
      calculate(other.cookie, b.cart.version),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(0);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .stock,
    ).toBe(20);
  });
  it("idempotently acknowledges deletion retries and protects operation history", async () => {
    const f = await retailCartFixture();
    await cartAddItem(f.buyer.cookie, f.v.id);
    const cart = await readBasket(f.buyer.cookie),
      key = randomUUID();
    const remove = () =>
      cartSet(
        request("/api/cart", "PATCH", f.buyer.cookie, {
          mode: "RETAIL",
          lineId: cart.lines[0].id,
          version: cart.cart.version,
          quantity: 0,
          requestId: key,
        }),
      );
    const a = await remove(),
      b = await remove();
    expect(a.status).toBe(200);
    expect((await payload(a)).data).toEqual((await payload(b)).data);
    expect((await readBasket(f.buyer.cookie)).lines).toHaveLength(0);
    await expect(
      db().cartOperation.delete({ where: { requestId: key } }),
    ).rejects.toThrow();
  });
  it("keeps cart row shape and quantity constraints in PostgreSQL", async () => {
    const f = await retailCartFixture();
    await cartAddItem(f.buyer.cookie, f.v.id);
    const cart = await readBasket(f.buyer.cookie);
    await expect(
      db().serverCartLine.update({
        where: { id: cart.lines[0].id },
        data: { quantity: -1 },
      }),
    ).rejects.toThrow();
    await expect(
      db().serverCartLine.update({
        where: { id: cart.lines[0].id },
        data: { mode: "WHOLESALE" },
      }),
    ).rejects.toThrow();
    expect((await cartAddItem(f.buyer.cookie, f.v.id, 1001)).status).toBe(422);
  });
  it("reserves current stock and persists immutable initial-order snapshots while consuming only its own cart", async () => {
    const f = await orderFixture();
    const response = await reserve(f.buyer.cookie, f.input);
    expect(response.status).toBe(200);
    const order = (await payload(response)).data;
    expect(order.status).toBe("RESERVED");
    expect(order.payableToman).toBeNull();
    expect(order.paymentReady).toBe(false);
    expect(order.subtotalToman).toBe("500000");
    expect(order.snapshot.lines[0].quantity).toBe(2);
    const variant = await db().productVariant.findUniqueOrThrow({
      where: { id: f.v.id },
    });
    expect(variant.reserved).toBe(2);
    expect(variant.stock).toBe(20);
    expect((await readBasket(f.buyer.cookie)).lines).toHaveLength(0);
    expect(await db().reservationMovement.count()).toBe(1);
    expect(await db().orderHold.count()).toBe(1);
    await expect(
      db().purchaseOrder.update({
        where: { id: order.id },
        data: { subtotalToman: "1" },
      }),
    ).rejects.toThrow();
    await expect(
      db().orderHold.updateMany({
        where: { orderId: order.id },
        data: { units: 1 },
      }),
    ).rejects.toThrow();
  });
  it("serializes parallel order retries and rejects reusing a key with different acceptance", async () => {
    const f = await orderFixture();
    const [a, b] = await Promise.all([
      reserve(f.buyer.cookie, f.input),
      reserve(f.buyer.cookie, f.input),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((await payload(a)).data.id).toBe((await payload(b)).data.id);
    expect(await db().purchaseOrder.count()).toBe(1);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(2);
    expect(
      (
        await reserve(f.buyer.cookie, {
          ...f.input,
          fingerprint: "0".repeat(64),
        })
      ).status,
    ).toBe(409);
  });
  it("does not create two orders from one cart version under distinct request IDs", async () => {
    const f = await orderFixture();
    const results = await Promise.all([
      reserve(f.buyer.cookie, f.input),
      reserve(f.buyer.cookie, { ...f.input, requestId: randomUUID() }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db().purchaseOrder.count()).toBe(1);
  });
  it("prevents overselling under competing customers and rolls back the losing cart transaction", async () => {
    const f = await orderFixture(15),
      other = await customer();
    await cartAddItem(other.cookie, f.v.id, 15);
    const b = await readBasket(other.cookie),
      quote = (await payload(await calculate(other.cookie, b.cart.version)))
        .data;
    const responses = await Promise.all([
      reserve(f.buyer.cookie, f.input),
      reserve(other.cookie, {
        mode: "RETAIL",
        version: b.cart.version,
        fingerprint: quote.fingerprint,
        requestId: randomUUID(),
      }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db().purchaseOrder.count()).toBe(1);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(15);
    expect(await db().serverCartLine.count()).toBe(1);
  });
  it("requires fresh customer auth, origin, exact schema and ownership for initial orders", async () => {
    const f = await orderFixture();
    expect((await reserve("", f.input)).status).toBe(401);
    expect((await reserve(f.owner.cookie, f.input)).status).toBe(403);
    expect(
      (await reserve(f.buyer.cookie, { ...f.input, subtotalToman: "1" }))
        .status,
    ).toBe(422);
    expect(
      (
        await reserveOrder(
          request("/api/orders", "POST", f.buyer.cookie, f.input, {
            Origin: "https://evil.invalid",
          }),
        )
      ).status,
    ).toBe(403);
    const order = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    const other = await customer();
    expect((await cancel(other.cookie, order.id)).status).toBe(404);
    expect(
      (
        await payload(
          await ordersRead(request("/api/orders", "GET", other.cookie)),
        )
      ).data.orders,
    ).toHaveLength(0);
  });
  it("rejects stale price acceptance even if quantities and availability remain unchanged", async () => {
    const f = await orderFixture();
    await transition(f.owner.cookie, f.p.id, "ARCHIVED");
    await transition(f.owner.cookie, f.p.id, "DRAFT");
    const p = await db().product.findUniqueOrThrow({ where: { id: f.p.id } });
    await editProduct(
      request("/api/admin/products/" + p.id, "PATCH", f.owner.cookie, {
        name: p.name,
        price: "333333",
        version: p.version,
      }),
      context(p.id),
    );
    await transition(f.owner.cookie, p.id, "PUBLISHED");
    const response = await reserve(f.buyer.cookie, f.input);
    expect(response.status).toBe(409);
    expect((await payload(response)).error.code).toBe("PRICE_REVIEW_REQUIRED");
    expect(await db().purchaseOrder.count()).toBe(0);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(0);
    expect((await readBasket(f.buyer.cookie)).lines).toHaveLength(1);
  });
  it("revalidates partner expiry and private price publication before placing a wholesale reservation", async () => {
    const f = await wholesaleFixture();
    const offer = await publishedOffer(f);
    await move(f.owner.cookie, f.v.id, 20);
    await cartAddItem(f.buyer.cookie, f.pack.id, 1, "WHOLESALE");
    const basket = await readBasket(f.buyer.cookie, "WHOLESALE"),
      quote = (
        await payload(
          await calculate(f.buyer.cookie, basket.cart.version, "WHOLESALE"),
        )
      ).data,
      input = {
        mode: "WHOLESALE",
        version: basket.cart.version,
        fingerprint: quote.fingerprint,
        requestId: randomUUID(),
      };
    await db().partnerAccount.update({
      where: { id: f.partner.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect((await reserve(f.buyer.cookie, input)).status).toBe(403);
    await db().partnerAccount.update({
      where: { id: f.partner.id },
      data: { expiresAt: null },
    });
    await offerState(f, offer.id, "ARCHIVED", 2);
    expect((await reserve(f.buyer.cookie, input)).status).toBe(409);
    expect(await db().purchaseOrder.count()).toBe(0);
  });
  it("reserves exact wholesale BOM units for one pack and freezes its reviewed private price", async () => {
    const f = await wholesaleFixture();
    await publishedOffer(f);
    await move(f.owner.cookie, f.v.id, 20);
    await cartAddItem(f.buyer.cookie, f.pack.id, 1, "WHOLESALE");
    const basket = await readBasket(f.buyer.cookie, "WHOLESALE"),
      quote = (
        await payload(
          await calculate(f.buyer.cookie, basket.cart.version, "WHOLESALE"),
        )
      ).data;
    const response = await reserve(f.buyer.cookie, {
      mode: "WHOLESALE",
      version: basket.cart.version,
      fingerprint: quote.fingerprint,
      requestId: randomUUID(),
    });
    expect(response.status).toBe(200);
    expect((await payload(response)).data.subtotalToman).toBe("7407402");
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(6);
  });
  it("idempotently cancels once under parallel requests and releases only the held units", async () => {
    const f = await orderFixture();
    const order = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    const [a, b] = await Promise.all([
      cancel(f.buyer.cookie, order.id),
      cancel(f.buyer.cookie, order.id),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((await payload(a)).data.status).toBe("CANCELLED");
    expect(await db().reservationMovement.count()).toBe(2);
    const variant = await db().productVariant.findUniqueOrThrow({
      where: { id: f.v.id },
    });
    expect(variant.stock).toBe(20);
    expect(variant.reserved).toBe(0);
    expect((await reserve(f.buyer.cookie, f.input)).status).toBe(200);
    expect(await db().purchaseOrder.count()).toBe(1);
  });
  it("releases expired reservations once across workers without deleting financial snapshots", async () => {
    const f = await orderFixture();
    const order = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    await expireFixture(order.id);
    await Promise.all([releaseExpiredOrders(), releaseExpiredOrders()]);
    const row = await db().purchaseOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(row.status).toBe("EXPIRED");
    expect(row.subtotalToman.toString()).toBe("500000");
    expect(row.version).toBe(2);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(0);
    expect(await db().reservationMovement.count()).toBe(2);
    await expect(db().reservationMovement.deleteMany()).rejects.toThrow();
  });
  it("enforces optimistic cancellation and never prematurely expires a live hold", async () => {
    const f = await orderFixture(),
      order = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    expect((await cancel(f.buyer.cookie, order.id, 2)).status).toBe(409);
    await releaseExpiredOrders();
    expect(
      (await db().purchaseOrder.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
    ).toBe("RESERVED");
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(2);
  });
  it("protects reserved units against ordinary inventory adjustment", async () => {
    const f = await orderFixture(15);
    await reserve(f.buyer.cookie, f.input);
    const version = (
      await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } })
    ).version;
    expect((await move(f.owner.cookie, f.v.id, -6, version)).status).toBe(409);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .stock,
    ).toBe(20);
  });
  it("rejects partial order transitions and reserved inventory below outstanding holds at commit", async () => {
    const f = await orderFixture();
    const o = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    await expect(
      db().purchaseOrder.update({
        where: { id: o.id },
        data: { status: "CANCELLED", version: 2, endedAt: new Date() },
      }),
    ).rejects.toThrow();
    await expect(
      db().productVariant.update({
        where: { id: f.v.id },
        data: { reserved: 0 },
      }),
    ).rejects.toThrow();
    expect(
      (await db().purchaseOrder.findUniqueOrThrow({ where: { id: o.id } }))
        .status,
    ).toBe("RESERVED");
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(2);
  });
  it("handles cancellation racing expiration without duplicate release or a negative reserved counter", async () => {
    const f = await orderFixture(),
      o = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    await expireFixture(o.id);
    const result = await Promise.all([
      cancel(f.buyer.cookie, o.id),
      releaseExpiredOrders(),
    ]);
    expect((result[0] as Response).status).toBe(200);
    expect(
      (await db().purchaseOrder.findUniqueOrThrow({ where: { id: o.id } }))
        .status,
    ).toBe("EXPIRED");
    expect(await db().reservationMovement.count()).toBe(2);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(0);
  });
  it("bounds active reservations per customer without consuming a rejected fourth cart", async () => {
    const f = await retailCartFixture();
    for (let i = 0; i < 4; i++) {
      await cartAddItem(f.buyer.cookie, f.v.id);
      const b = await readBasket(f.buyer.cookie),
        q = (await payload(await calculate(f.buyer.cookie, b.cart.version)))
          .data;
      const r = await reserve(f.buyer.cookie, {
        mode: "RETAIL",
        version: b.cart.version,
        fingerprint: q.fingerprint,
        requestId: randomUUID(),
      });
      expect(r.status).toBe(i < 3 ? 200 : 409);
    }
    expect(await db().purchaseOrder.count()).toBe(3);
    expect((await readBasket(f.buyer.cookie)).lines).toHaveLength(1);
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(3);
  });
  it("runs the maintenance CLI on the isolated test DB and releases expiry without customer traffic", async () => {
    const f = await orderFixture(),
      o = (await payload(await reserve(f.buyer.cookie, f.input))).data;
    await expireFixture(o.id);
    const result = spawnSync(process.execPath, ["scripts/db-maintenance.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env },
      encoding: "utf8",
      timeout: 15000,
    });
    expect(result.status).toBe(0);
    expect(
      (await db().purchaseOrder.findUniqueOrThrow({ where: { id: o.id } }))
        .status,
    ).toBe("EXPIRED");
    expect(
      (await db().productVariant.findUniqueOrThrow({ where: { id: f.v.id } }))
        .reserved,
    ).toBe(0);
  });
});
