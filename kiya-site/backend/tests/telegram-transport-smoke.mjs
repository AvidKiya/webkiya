// Finite real worker-process test; only the official Telegram HTTP transport is mocked.
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { Client } from "pg";
import { setTimeout as delay } from "node:timers/promises";
const env = parse(readFileSync(".env.local")),
  url = new URL(env.TEST_DATABASE_URL);
assert.equal(url.pathname, "/kiya_test");
assert(["127.0.0.1", "localhost"].includes(url.hostname));
const db = new Client({ connectionString: url.href });
await db.connect();
const id = randomUUID(),
  capture = process.cwd() + "/.data/transport-smoke-" + id + ".json",
  preload = process.cwd() + "/.data/transport-smoke-" + id + ".mjs";
mkdirSync(".data", { recursive: true });
const iv = randomBytes(12),
  cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(env.MFA_ENCRYPTION_KEY, "hex"),
    iv,
  ),
  body = Buffer.concat([
    cipher.update("TRANSPORT-SMOKE-123456"),
    cipher.final(),
  ]),
  encrypted = [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    body.toString("hex"),
  ].join(".");
const row = await db.query(
  'SELECT "botTokenEncrypted" FROM "StoreSettings" WHERE id=1 AND "telegramEnabled"=true',
);
assert.equal(row.rowCount, 1, "Prepare isolated UI fixtures first");
await db.query(
  'INSERT INTO "TelegramOutbox"(id,"chatId",text) VALUES($1,666001,$2)',
  [id, "otp-encrypted:" + encrypted],
);
writeFileSync(capture, "[]", { mode: 0o600 });
writeFileSync(
  preload,
  `import{readFileSync,writeFileSync}from'node:fs';const file=${JSON.stringify(capture)};globalThis.fetch=async(url,options)=>{const method=String(url).split('/').at(-1);if(!['getMe','deleteWebhook','getUpdates','sendMessage'].includes(method))throw Error('Unexpected transport');const body=JSON.parse(options.body);const events=JSON.parse(readFileSync(file,'utf8'));events.push({method,body});writeFileSync(file,JSON.stringify(events));return new Response(JSON.stringify({ok:true,result:method==='getMe'?{username:'kiyaco24bot'}:method==='getUpdates'?[]:true}),{headers:{'content-type':'application/json'}});};`,
  { mode: 0o600 },
);
const worker = spawn(
  process.execPath,
  ["--import", preload, "scripts/telegram-worker.mjs", "--poll"],
  { env: { ...process.env, DATABASE_URL: url.href }, stdio: "ignore" },
);
const exited = new Promise((resolve) => worker.on("exit", resolve));
try {
  let sent = false;
  for (let i = 0; i < 100; i++) {
    const events = JSON.parse(readFileSync(capture, "utf8"));
    if (
      events.some(
        (e) =>
          e.method === "sendMessage" &&
          e.body.text === "TRANSPORT-SMOKE-123456",
      )
    ) {
      sent = true;
      break;
    }
    await delay(100);
  }
  assert(sent, "Worker must decrypt and send OTP content");
  const events = JSON.parse(readFileSync(capture, "utf8"));
  assert(events.some((e) => e.method === "getMe"));
  assert(
    events.some(
      (e) =>
        e.method === "deleteWebhook" && e.body.drop_pending_updates === false,
    ),
  );
  assert(events.some((e) => e.method === "getUpdates"));
  assert.equal(
    (await db.query('SELECT state FROM "TelegramOutbox" WHERE id=$1', [id]))
      .rows[0].state,
    "SENT",
  );
  console.log(
    "PASS: actual worker process verifies bot, configures polling without dropping updates, polls, decrypts private OTP outbox and marks delivery SENT. Telegram API mocked; no real provider calls.",
  );
} finally {
  worker.kill("SIGTERM");
  await Promise.race([exited, delay(3000)]);
  if (worker.exitCode === null) worker.kill("SIGKILL");
  await db.end();
  for (const file of [capture, preload]) if (existsSync(file)) unlinkSync(file);
}
