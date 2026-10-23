import { describe, it, expect, vi } from "vitest";
import { createCipheriv, randomBytes } from "node:crypto";
import {
  drainTelegram,
  telegramConfiguration,
  telegramCall,
} from "../cloudflare/telegram.mjs";
const key = randomBytes(32).toString("hex");
const env = {
  TELEGRAM_LOGIN_ENABLED: "true",
  TELEGRAM_BOT_TOKEN: "synthetic-test-token",
  TELEGRAM_WEBHOOK_SECRET: "synthetic-test-secret",
  MFA_ENCRYPTION_KEY: key,
};
function encrypted(text: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const body = Buffer.concat([c.update(text), c.final()]);
  return [
    iv.toString("hex"),
    c.getAuthTag().toString("hex"),
    body.toString("hex"),
  ].join(".");
}
function fixture({
  locked = true,
  enabled = true,
  pending = true,
  contact = false,
} = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked }] };
    if (sql.includes('FROM "StoreSettings"'))
      return { rows: enabled ? [] : [{ telegramEnabled: false }] };
    if (sql.startsWith('SELECT id FROM "TelegramOutbox"'))
      return { rows: pending ? [{ id: "fixture" }] : [] };
    if (sql.includes("RETURNING *")) {
      const rows = pending
        ? [
            {
              id: "fixture",
              chatId: 111n,
              text: "otp-encrypted:" + encrypted("synthetic OTP"),
              requestContact: contact,
            },
          ]
        : [];
      pending = false;
      return { rows };
    }
    return { rows: [] };
  });
  const transport = vi.fn(
    async (url: RequestInfo | URL) =>
      new Response(
        JSON.stringify({
          ok: true,
          result: String(url).endsWith("getMe")
            ? { username: "kiyaco24bot" }
            : true,
        }),
      ),
  );
  return { client: { query }, query, transport };
}
describe("Cloudflare finite Telegram transport (synthetic provider)", () => {
  it("uses env before first admin exists", async () => {
    const f = fixture();
    expect(await telegramConfiguration(f.client, env)).toEqual({
      token: env.TELEGRAM_BOT_TOKEN,
      secret: env.TELEGRAM_WEBHOOK_SECRET,
      username: "kiyaco24bot",
    });
  });
  it("respects disabled settings and never calls provider", async () => {
    const f = fixture({ enabled: false });
    expect(await drainTelegram(f.client, env, f.transport)).toEqual({
      sent: 0,
    });
    expect(f.transport).not.toHaveBeenCalled();
    expect(f.query.mock.calls.at(-1)?.[0]).toContain("pg_advisory_unlock");
  });
  it("does not compete with Node or another request", async () => {
    const f = fixture({ locked: false });
    expect(await drainTelegram(f.client, env, f.transport)).toEqual({
      sent: 0,
      busy: true,
    });
    expect(f.query).toHaveBeenCalledTimes(1);
    expect(f.transport).not.toHaveBeenCalled();
  });
  it("does not contact provider when idle", async () => {
    const f = fixture({ pending: false });
    await drainTelegram(f.client, env, f.transport);
    expect(f.transport).not.toHaveBeenCalled();
  });
  it("decrypts OTP only for sending and marks SENT", async () => {
    const f = fixture({ contact: true });
    expect(await drainTelegram(f.client, env, f.transport)).toEqual({
      sent: 1,
    });
    expect(f.transport).toHaveBeenCalledTimes(2);
    const args = f.transport.mock.calls[1] as unknown as [
      string,
      { body: string },
    ];
    const body = JSON.parse(args[1].body);
    expect(body.text).toBe("synthetic OTP");
    expect(body.chat_id).toBe("111");
    expect(body.reply_markup.keyboard[0][0].request_contact).toBe(true);
    expect(
      f.query.mock.calls.some(([s]) => s.includes("SET state='SENT'")),
    ).toBe(true);
  });
  it("fails closed on wrong bot and releases lock", async () => {
    const f = fixture();
    f.transport.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ ok: true, result: { username: "another_bot" } }),
        ),
    );
    await expect(drainTelegram(f.client, env, f.transport)).rejects.toThrow(
      "TELEGRAM_BOT_MISMATCH",
    );
    expect(f.query.mock.calls.some(([s]) => s.includes("RETURNING *"))).toBe(
      false,
    );
    expect(f.query.mock.calls.at(-1)?.[0]).toContain("pg_advisory_unlock");
  });
  it("does not retry uncertain send or expose provider error", async () => {
    const f = fixture();
    f.transport.mockImplementation(async (url) => {
      if (String(url).endsWith("sendMessage"))
        throw Error("PRIVATE_PROVIDER_PAYLOAD");
      return new Response(
        JSON.stringify({ ok: true, result: { username: "kiyaco24bot" } }),
      );
    });
    await expect(drainTelegram(f.client, env, f.transport)).rejects.toThrow(
      "TELEGRAM_DELIVERY_UNCONFIRMED",
    );
    expect(
      f.query.mock.calls.some(([s]) =>
        s.includes("SET state='UNKNOWN' WHERE id"),
      ),
    ).toBe(true);
    expect(f.transport).toHaveBeenCalledTimes(2);
    expect(f.query.mock.calls.at(-1)?.[0]).toContain("pg_advisory_unlock");
  });
  it("sanitizes failed provider response including rate limits", async () => {
    const transport = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            description: "PRIVATE_PROVIDER_PAYLOAD",
            error_code: 429,
          }),
          { status: 429 },
        ),
    );
    await expect(
      telegramCall("synthetic", "sendMessage", {}, transport),
    ).rejects.toThrow("TELEGRAM_PROVIDER_UNAVAILABLE");
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
