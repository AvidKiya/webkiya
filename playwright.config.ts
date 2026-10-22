import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Reproducible Linux test browser from npm; no live CDN download required.
const libs = join(tmpdir(), "kiya-browser-libs");
if (
  process.platform === "linux" &&
  !existsSync(join(libs, "lib/libnspr4.so"))
) {
  mkdirSync(libs, { recursive: true });
  const archive = join(libs, "al2023.tar");
  writeFileSync(
    archive,
    brotliDecompressSync(
      readFileSync("node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
    ),
  );
  execFileSync("tar", ["-xf", archive, "-C", libs]);
}
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    headless: true,
    launchOptions: {
      args: chromium.args.filter(
        (arg) =>
          ![
            "--single-process",
            "--disable-web-security",
            "--allow-running-insecure-content",
          ].includes(arg),
      ),
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_PATH ||
        (await chromium.executablePath()),
      env: {
        ...process.env,
        LD_LIBRARY_PATH: `${libs}/lib${process.env.LD_LIBRARY_PATH ? ":" + process.env.LD_LIBRARY_PATH : ""}`,
      },
    },
  },
  webServer: {
    command: "npm run start -- --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  reporter: "list",
});
