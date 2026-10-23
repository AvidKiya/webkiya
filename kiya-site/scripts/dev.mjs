import { spawn } from "node:child_process";
const children = ["backend", "frontend"].map((name) =>
  spawn("npm", ["--prefix", name, "run", "dev"], { stdio: "inherit" }),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill("SIGTERM"));
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, stop);
children.forEach((child) =>
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  }),
);
