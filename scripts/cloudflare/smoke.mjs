const base = process.env.CF_PREVIEW_URL;
if (
  !base ||
  !/^https:\/\/kiya-store-preview\.[a-z0-9-]+\.workers\.dev$/.test(base)
)
  throw new Error("An exact workers.dev preview URL is required");
for (const path of ["/progress", "/api/catalog", "/api/auth/me"]) {
  const response = await fetch(base + path, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error("Deployed preview smoke check failed: " + path);
  if (path === "/api/catalog") {
    const p = await response.json();
    if (
      !p.ok ||
      !Array.isArray(p.data?.items) ||
      p.data.items.some((i) => i.isDemo)
    )
      throw new Error("Live catalog check failed");
  }
  if (path === "/api/auth/me") {
    const p = await response.json();
    if (!p.ok || p.data?.user !== null || p.data?.demoLoginAvailable !== false)
      throw new Error("Live auth safety check failed");
  }
}
console.log(
  "Preview response/catalog/live-auth smoke checks passed; no payment or customer data was created.",
);
