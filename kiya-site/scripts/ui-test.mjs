import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["scripts/ui-test-server.mjs"], {
    cwd: "backend",
    stdio: "inherit",
  }),
  spawn("npm", ["run", "dev", "--", "--port", "3110"], {
    cwd: "frontend",
    stdio: "inherit",
    env: { ...process.env, KIYA_BACKEND_ORIGIN: "http://127.0.0.1:3111" },
  }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
for (const child of children)
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
