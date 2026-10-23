// Run only as a disposable integration service; never points at the development or live DB.
import { config } from "dotenv";
import { spawn } from "node:child_process";
config({ path: ".env.local", quiet: true });
const url = new URL(process.env.TEST_DATABASE_URL || "postgresql://invalid");
if (
  url.pathname !== "/kiya_test" ||
  !["127.0.0.1", "localhost"].includes(url.hostname)
)
  throw new Error("UI integration tests require local kiya_test");
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    "3111",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url.toString(),
      APP_MODE: "demo",
      ALLOW_DEMO_LOGIN: "true",
      MEDIA_ROOT: process.cwd() + "/.data/test-media",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
