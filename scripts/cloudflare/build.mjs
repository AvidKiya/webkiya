import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { wasm } from "@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs";
// Pinned Prisma/OpenNext compatibility bridge. Only generated/ignored files are
// patched. Exact guards fail closed on upstream changes; Node client is restored.
mkdirSync(".data", { recursive: true });
const env = { ...process.env, KIYA_BUILD_TARGET: "cloudflare" };
function run(args) {
  const r = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (r.status !== 0) throw new Error("Cloudflare build step failed");
}
function replaceOnce(path, from, to) {
  const source = readFileSync(path, "utf8");
  if (source.split(from).length !== 2)
    throw new Error("Pinned Cloudflare compatibility guard failed: " + path);
  writeFileSync(path, source.replace(from, to));
}
let failed = false;
try {
  run(["scripts/prisma-wasm.mjs", "generate"]);
  writeFileSync(
    ".data/cloudflare-query-compiler.wasm",
    Buffer.from(wasm, "base64"),
  );
  replaceOnce(
    "src/generated/prisma/internal/class.ts",
    'const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs")\n    return await decodeBase64AsWasm(wasm)',
    'return globalThis[Symbol.for("kiya.prisma.compiler")]',
  );
  run(["node_modules/@opennextjs/cloudflare/dist/cli/index.js", "build"]);
  // OpenNext otherwise embeds .env.local, including private values, into the
  // Worker. Only explicit Wrangler vars/secrets are permitted in this deployment.
  const envModule = ".open-next/cloudflare/next-env.mjs";
  if (!readFileSync(envModule, "utf8").includes("export const production = "))
    throw new Error("OpenNext environment module format changed");
  writeFileSync(
    envModule,
    "export const production = {};\nexport const development = {};\nexport const test = {};\n",
  );
  replaceOnce(
    ".open-next/middleware/handler.mjs",
    "_module = await (await Promise.resolve().then(() => __toESM(require_middleware()))).default;",
    "_module = await require_middleware();",
  );
  replaceOnce(
    ".open-next/middleware/handler.mjs",
    "const { CloudflareSocket } = require_empty();",
    'const CloudflareSocket = globalThis[Symbol.for("kiya.pg.socket")];',
  );
} catch (error) {
  console.error(error.message);
  failed = true;
} finally {
  try {
    run(["scripts/prisma-wasm.mjs", "generate"]);
  } catch {
    failed = true;
  }
}
if (failed) process.exit(1);
