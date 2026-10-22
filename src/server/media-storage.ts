import "server-only";
import { join } from "node:path";
export function mediaDirectory() {
  return process.env.MEDIA_ROOT || join(process.cwd(), ".data/media");
}

export async function storeMedia(id: string, bytes: Buffer) {
  if (process.env.KIYA_RUNTIME === "cloudflare") {
    const { cloudflareMedia } = await import("./runtime-scope");
    await cloudflareMedia().bucket.put(
      "media/" + id + ".webp",
      new Uint8Array(bytes),
      { httpMetadata: { contentType: "image/webp" } },
    );
    return;
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(mediaDirectory(), { recursive: true, mode: 0o700 });
  try {
    await writeFile(join(mediaDirectory(), id + ".webp"), bytes, {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if (!(e && typeof e === "object" && "code" in e && e.code === "EEXIST"))
      throw e;
  }
}
export async function loadMedia(id: string): Promise<Buffer> {
  if (process.env.KIYA_RUNTIME === "cloudflare") {
    const { cloudflareMedia } = await import("./runtime-scope");
    const object = await cloudflareMedia().bucket.get("media/" + id + ".webp");
    if (!object) throw new Error("MEDIA_NOT_FOUND");
    return Buffer.from(await object.arrayBuffer());
  }
  const { readFile } = await import("node:fs/promises");
  return readFile(join(mediaDirectory(), id + ".webp"));
}
