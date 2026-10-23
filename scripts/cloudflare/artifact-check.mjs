import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { parse } from "dotenv";
const names = [
  "CLOUDFLARE_API_TOKEN",
  "DATABASE_URL",
  "TEST_DATABASE_URL",
  "AUTH_SECRET",
  "MFA_ENCRYPTION_KEY",
];
const values = names.map((n) => process.env[n]).filter(Boolean);
for (const file of [".env.local", ".dev.vars"])
  if (existsSync(file)) {
    const env = parse(readFileSync(file));
    values.push(...names.map((n) => env[n]).filter(Boolean));
  }
const environment = readFileSync(".open-next/cloudflare/next-env.mjs", "utf8");
if (
  !/^export const production = \{\};\s*export const development = \{\};\s*export const test = \{\};\s*$/.test(
    environment,
  )
)
  throw new Error("Worker must not contain compiled dotenv settings");
function walk(path) {
  for (const name of readdirSync(path)) {
    const file = path + "/" + name;
    if (statSync(file).isDirectory()) walk(file);
    else {
      const bytes = readFileSync(file);
      if (values.some((value) => bytes.includes(value)))
        throw new Error(
          "Private setting found in generated upload; deployment refused",
        );
    }
  }
}
walk(".open-next/assets");
walk(".data/cloudflare-dry-run");
console.log("Worker upload/asset secret scan passed (values never printed).");
