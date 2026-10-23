import { spawnSync } from "node:child_process";
// generate/validate use the npm-shipped WASM compiler. In this offline sandbox
// Prisma's CLI still eagerly resolves a native schema-engine it does not use.
// Point resolution at an existing executable; NEVER use this for migrate/diff.
const operation = process.argv[2];
if (!["generate", "validate"].includes(operation))
  throw new Error("WASM helper supports generate/validate only");
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", operation],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PRISMA_SCHEMA_ENGINE_BINARY:
        process.env.PRISMA_SCHEMA_ENGINE_BINARY || process.execPath,
    },
  },
);
process.exit(result.status ?? 1);
