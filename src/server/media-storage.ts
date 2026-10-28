import "server-only";
import { join } from "node:path";
export function mediaDirectory() {
  return process.env.MEDIA_ROOT || join(process.cwd(), ".data/media");
}

export async function storeMedia(id: string, bytes: Buffer) {
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
  const { readFile } = await import("node:fs/promises");
  return readFile(join(mediaDirectory(), id + ".webp"));
}
