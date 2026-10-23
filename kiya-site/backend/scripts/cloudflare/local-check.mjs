import { config as dotenv } from "dotenv";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
dotenv({ path: ".env.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/kiya_test")
  throw new Error(
    "Only the isolated kiya_test database is allowed for Worker checks",
  );
const directory = ".data/cloudflare-local-check";
mkdirSync(directory, { recursive: true, mode: 0o700 });
const { parse } = await import("jsonc-parser");
const errors = [];
const config = parse(readFileSync("wrangler.jsonc", "utf8"), errors, {
  allowTrailingComma: true,
});
if (errors.length) throw new Error("Invalid Worker configuration");
config.name = "kiya-local-runtime-check";
config.main = resolve("cloudflare/worker.mjs");
config.assets.directory = resolve(".open-next/assets");
config.services[0].service = config.name;
writeFileSync(directory + "/wrangler.json", JSON.stringify(config));
const secrets = {
  DATABASE_URL: url,
  AUTH_SECRET: randomBytes(32).toString("hex"),
  // The guarded test DB may contain encrypted synthetic integration settings.
  MFA_ENCRYPTION_KEY:
    process.env.MFA_ENCRYPTION_KEY || randomBytes(32).toString("hex"),
  APP_MODE: "live",
  ALLOW_DEMO_LOGIN: "false",
};
writeFileSync(
  directory + "/.dev.vars",
  Object.entries(secrets)
    .map(([k, v]) => k + "=" + JSON.stringify(v))
    .join("\n"),
  { mode: 0o600 },
);
const child = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--config",
    directory + "/wrangler.json",
    "--ip",
    "0.0.0.0",
    "--port",
    "8788",
  ],
  {
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  },
);
try {
  await new Promise((ok, fail) => {
    const timer = setTimeout(
      () => fail(new Error("Local Worker startup timeout")),
      90000,
    );
    let output = "";
    const onData = (chunk) => {
      output = (output + chunk.toString()).slice(-16000);
      if (output.includes("Ready on")) {
        clearTimeout(timer);
        ok();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", () => {
      clearTimeout(timer);
      fail(new Error("Local Worker exited before readiness"));
    });
  });
  const origin = "http://127.0.0.1:8788";
  for (const [path, status] of [
    ["/", 200],
    ["/progress", 200],
    ["/api/catalog", 200],
    ["/api/auth/me", 200],
    ["/p/nonexistent-worker-test-post", 404],
    ["/nonexistent-worker-test-section", 404],
    ["/cdn-cgi/local/scheduled", 200],
  ]) {
    const r = await fetch(origin + path, {
      signal: AbortSignal.timeout(20000),
    });
    if (r.status !== status)
      throw new Error("Local Worker status check failed: " + path);
    if (path === "/") {
      const html = await r.text();
      if (!html.includes('id="root"'))
        throw new Error("Selected storefront missing from Worker root");
      const script = html.match(/<script[^>]+src="([^"]+\.js)"/);
      if (!script || !script[1].startsWith("/assets/"))
        throw new Error("Selected storefront assets missing");
      const asset = await fetch(origin + script[1]);
      if (!asset.ok) throw new Error("Selected storefront script unavailable");
      await asset.arrayBuffer();
    } else if (path === "/api/auth/me") {
      const p = await r.json();
      if (p.data?.demoLoginAvailable !== false || p.data?.user !== null)
        throw new Error("Worker live-auth safety check failed");
    } else await r.arrayBuffer();
  }
  const r = await fetch(origin + "/api/auth/staff", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      handle: "nonexistent-worker-test",
      password: "invalid-worker-smoke-password",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (r.status !== 401)
    throw new Error("Worker DB/password rejection check failed");
  await r.arrayBuffer();
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      const r = await fetch(origin + "/api/catalog");
      if (!r.ok) throw new Error("Concurrent Worker DB scope check failed");
      await r.arrayBuffer();
    }),
  );
  console.log(
    "Local workerd: selected storefront/JS, routing/404, PostgreSQL, live-auth flags, scrypt, concurrent request scopes and scheduled maintenance passed. No remote deployment was performed.",
  );
} finally {
  const exited = once(child, "exit");
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* already stopped */
  }
  await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    /* already stopped */
  }
}
