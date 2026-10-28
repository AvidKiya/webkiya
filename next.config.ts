import type { NextConfig } from "next";
const config: NextConfig = {
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
