import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
}
export function passwordMatches(password: string, encoded: string) {
  try {
    const [salt, digest] = encoded.split(":");
    if (!salt || digest?.length !== 128) return false;
    return timingSafeEqual(
      Buffer.from(digest, "hex"),
      scryptSync(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 }),
    );
  } catch {
    return false;
  }
}
function encryptionKey() {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
    throw new Error("MFA_ENCRYPTION_KEY_UNCONFIGURED");
  return Buffer.from(raw, "hex");
}
export function encrypt(secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    body.toString("hex"),
  ].join(".");
}
export function decrypt(encoded: string) {
  const [iv, tag, data] = encoded.split(".");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "hex"),
  );
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    cipher.update(Buffer.from(data, "hex")),
    cipher.final(),
  ]).toString("utf8");
}
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5)
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
export function totp(secret: string, time = Date.now()): string {
  let bits = "";
  for (const c of secret) {
    const value = BASE32.indexOf(c);
    if (value < 0) throw new Error("Invalid TOTP seed");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
      .update(counter)
      .digest(),
    offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export function verifyTotp(secret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((offset) =>
    timingSafeEqual(
      Buffer.from(code),
      Buffer.from(totp(secret, Date.now() + offset * 30000)),
    ),
  );
}
export function totpStep(secret: string, code: string): bigint | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Date.now();
  for (const offset of [-1, 0, 1]) {
    const time = now + offset * 30000;
    if (timingSafeEqual(Buffer.from(code), Buffer.from(totp(secret, time))))
      return BigInt(Math.floor(time / 30000));
  }
  return null;
}
