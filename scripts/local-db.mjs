import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";
mkdirSync(".data", { recursive: true, mode: 0o700 });
if (!existsSync(".env.local")) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    ".env.local",
    `DATABASE_URL=postgresql://kiya:${password}@127.0.0.1:55432/kiya_dev\nTEST_DATABASE_URL=postgresql://kiya:${password}@127.0.0.1:55432/kiya_test\nAPP_MODE=demo\nALLOW_DEMO_LOGIN=true\nAUTH_SECRET=${randomBytes(32).toString("hex")}\nMFA_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600 },
  );
}
const env = parse(readFileSync(".env.local"));
const url = new URL(env.DATABASE_URL);
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw new Error("This helper starts only the local sandbox database");
const pg = new EmbeddedPostgres({
  databaseDir: ".data/postgres",
  user: url.username,
  password: url.password,
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () =>
    console.error("PostgreSQL diagnostic (connection details withheld)"),
});
if (!existsSync(".data/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
for (const name of ["kiya_dev", "kiya_test"]) {
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
}
await client.end();
console.log(
  "Local PostgreSQL ready on 127.0.0.1:55432. Local secrets stored in ignored .env.local; no remote services configured.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
// A local helper, not a production database supervisor.
setInterval(() => {}, 60000);
