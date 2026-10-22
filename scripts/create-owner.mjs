import { config } from "dotenv";
import { Client } from "pg";
import { randomBytes, scryptSync } from "node:crypto";
config({ path: ".env.local", quiet: true });
const args = process.argv.slice(2),
  handle = args[args.indexOf("--handle") + 1],
  name = args[args.indexOf("--name") + 1];
const phoneInput = args.includes("--phone")
  ? args[args.indexOf("--phone") + 1]
  : undefined;
const phone = phoneInput
  ? /^09[0-9]{9}$/.test(phoneInput)
    ? "+98" + phoneInput.slice(1)
    : /^\+989[0-9]{9}$/.test(phoneInput)
      ? phoneInput
      : null
  : null;
if (phoneInput && !phone) throw new Error("Invalid Iranian mobile format");
const password = process.env.KIYA_OWNER_PASSWORD;
delete process.env.KIYA_OWNER_PASSWORD;
if (
  !args.includes("--handle") ||
  !args.includes("--name") ||
  !handle ||
  !/^[a-z0-9_-]{3,60}$/.test(handle) ||
  !name ||
  name.length > 80
)
  throw new Error(
    'Usage: npm run owner:create -- --handle kiya-owner --name "Owner name"',
  );
if (!password || password.length < 14 || password.length > 200)
  throw new Error(
    "Set KIYA_OWNER_PASSWORD locally (14–200 characters); never put it in chat, a command argument or source control.",
  );
if (!process.env.MFA_ENCRYPTION_KEY || !process.env.AUTH_SECRET)
  throw new Error(
    "Configure stable encryption and session secrets before bootstrap.",
  );
const salt = randomBytes(16).toString("hex"),
  encoded =
    salt +
    ":" +
    scryptSync(password, salt, 64, {
      N: 32768,
      maxmem: 64 * 1024 * 1024,
    }).toString("hex");
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(27102027)");
  const owners = await client.query(
    'SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id=ur."roleId" WHERE r.key=\'OWNER\' LIMIT 1',
  );
  if (owners.rowCount)
    throw new Error(
      "An owner already exists. This one-time command does not replace or reset owners.",
    );
  const role = await client.query("SELECT id FROM \"Role\" WHERE key='OWNER'");
  if (!role.rowCount) throw new Error("Run db:seed first.");
  const user = await client.query(
    'INSERT INTO "User" (kind,"displayName",handle,"passwordHash",phone) VALUES(\'STAFF\',$1,$2,$3,$4) RETURNING id',
    [name, handle, encoded, phone],
  );
  await client.query(
    'INSERT INTO "UserRole"("userId","roleId") VALUES($1,$2)',
    [user.rows[0].id, role.rows[0].id],
  );
  await client.query(
    'INSERT INTO "AuditLog"("actorId",action,"resourceId",data) VALUES($1,\'owner:bootstrap\',$2,\'{"source":"local-cli","mfaRequired":true}\')',
    [user.rows[0].id, user.rows[0].id],
  );
  await client.query("COMMIT");
  console.log(
    "Owner created. Sign in at /admin and enroll MFA before accessing any management data. No default password exists.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
