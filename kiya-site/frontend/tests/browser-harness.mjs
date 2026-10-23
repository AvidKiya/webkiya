import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(join(root, "backend/package.json"));
const { chromium: playwright } = require("playwright");
const Chromium = require("@sparticuz/chromium").default;
const libs = join(tmpdir(), "kiya-rebuild-browser-libs");
if (!existsSync(join(libs, "lib/libnspr4.so"))) {
  mkdirSync(libs, { recursive: true });
  const archive = join(libs, "libs.tar");
  writeFileSync(
    archive,
    brotliDecompressSync(
      readFileSync(
        join(
          root,
          "backend/node_modules/@sparticuz/chromium/bin/al2023.tar.br",
        ),
      ),
    ),
  );
  execFileSync("tar", ["-xf", archive, "-C", libs]);
}
export async function launchBrowser() {
  return playwright.launch({
    headless: true,
    executablePath: await Chromium.executablePath(),
    args: Chromium.args.filter(
      (arg) =>
        ![
          "--single-process",
          "--disable-web-security",
          "--allow-running-insecure-content",
        ].includes(arg),
    ),
    env: { ...process.env, LD_LIBRARY_PATH: join(libs, "lib") },
  });
}
