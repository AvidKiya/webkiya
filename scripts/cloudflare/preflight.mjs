import { Client } from "pg";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, appendFileSync } from "node:fs";
const names = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "DATABASE_URL",
  "AUTH_SECRET",
  "MFA_ENCRYPTION_KEY",
];
const missing = names.filter((n) => !process.env[n]);
if (missing.length)
  throw new Error("Missing secure settings: " + missing.join(", "));
if (!/^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_ACCOUNT_ID))
  throw new Error("Invalid Cloudflare account ID");
if (
  !/^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY) ||
  process.env.AUTH_SECRET.length < 32
)
  throw new Error("Invalid auth encryption settings");
const url = new URL(process.env.DATABASE_URL);
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !url.password ||
  ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname) ||
  !["require", "verify-full", "verify-ca"].includes(
    url.searchParams.get("sslmode"),
  )
)
  throw new Error(
    "A remote TLS PostgreSQL database is required; sandbox URLs are not deployable",
  );
const headers = { Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN };
for (const path of [
  "/user/tokens/verify",
  "/accounts/" +
    process.env.CLOUDFLARE_ACCOUNT_ID +
    "/r2/buckets/kiya-private-media",
]) {
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.success)
    throw new Error(
      "Cloudflare permission or existing media bucket check failed",
    );
}
const subdomainResponse = await fetch(
  "https://api.cloudflare.com/client/v4/accounts/" +
    process.env.CLOUDFLARE_ACCOUNT_ID +
    "/workers/subdomain",
  { headers, signal: AbortSignal.timeout(15000) },
);
const subdomainResult = await subdomainResponse.json();
const subdomain = subdomainResult.result?.subdomain;
if (
  !subdomainResponse.ok ||
  !subdomainResult.success ||
  typeof subdomain !== "string" ||
  !/^[a-z0-9-]{1,63}$/.test(subdomain)
)
  throw new Error(
    "Configure the account workers.dev subdomain before deployment",
  );
const preview = "https://kiya-store-preview." + subdomain + ".workers.dev";
if (process.env.GITHUB_ENV)
  appendFileSync(process.env.GITHUB_ENV, "CF_PREVIEW_URL=" + preview + "\n");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  const rows = (
    await client.query("SELECT name,checksum FROM kiya_schema_migrations")
  ).rows;
  for (const name of readdirSync("prisma/migrations").filter((n) =>
    /^\d/.test(n),
  )) {
    const checksum = createHash("sha256")
      .update(readFileSync("prisma/migrations/" + name + "/migration.sql"))
      .digest("hex");
    if (!rows.some((r) => r.name === name && r.checksum === checksum))
      throw new Error(
        "Database migration check failed; reviewed migrations and backup are required",
      );
  }
  console.log(
    "Cloudflare credentials, existing bucket and PostgreSQL schema preflight passed.",
  );
} catch {
  throw new Error(
    "Database TLS/schema preflight failed (connection details withheld)",
  );
} finally {
  await client.end();
}
