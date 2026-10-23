import { spawnSync } from "node:child_process";
// The backend test setup refuses any URL whose DB name is not kiya_test.
const result = spawnSync("npm", ["run", "test:backend"], {
  stdio: "inherit",
  env: { ...process.env, KIYA_EXPORT_WHOLESALE_UI: "true" },
});
process.exitCode = result.status ?? 1;
