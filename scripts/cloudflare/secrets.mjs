import { spawnSync } from "node:child_process";
const names = ["DATABASE_URL", "AUTH_SECRET", "MFA_ENCRYPTION_KEY"];
if (names.some((n) => !process.env[n]))
  throw new Error("Worker secrets are missing");
const body = JSON.stringify(
  Object.fromEntries(names.map((n) => [n, process.env[n]])),
);
// Pipe secrets via stdin, never command arguments, logs, files or workflow inputs.
const result = spawnSync(
  "node",
  ["node_modules/wrangler/bin/wrangler.js", "secret", "bulk"],
  { input: body, encoding: "utf8", env: process.env },
);
if (result.status !== 0)
  throw new Error("Worker secret configuration failed; output withheld");
console.log("Worker secrets configured (values withheld).");
