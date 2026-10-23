import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// No shared cache for private prices/accounts. webpack avoids experimental
// Turbopack Node middleware interop in this exact Next/OpenNext combination.
const config = defineCloudflareConfig();
config.buildCommand = "npx next build --webpack";
export default config;
