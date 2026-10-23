import type { NextConfig } from "next";
const config: NextConfig = {
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  poweredByHeader: false,
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
