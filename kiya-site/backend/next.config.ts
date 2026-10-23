import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep disposable browser-test compiler output separate from the live preview build.
  distDir: process.env.KIYA_UI_TEST === "true" ? ".next/ui-test" : ".next",
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pg-cloudflare/dist/**/*",
      "./node_modules/pg-cloudflare/esm/**/*",
    ],
  },
  images: { unoptimized: process.env.KIYA_BUILD_TARGET === "cloudflare" },
  devIndicators: false,
};
export default config;
