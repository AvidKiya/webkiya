import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  globalIgnores([
    ".next/**",
    "kiya-site/**",
    ".open-next/**",
    ".wrangler/**",
    "کیایی که دوسش داشتم/**",
    ".data/**",
    "src/generated/**",
    "file/preview*/**",
    "file/references/**",
    "next-env.d.ts",
  ]),
]);
