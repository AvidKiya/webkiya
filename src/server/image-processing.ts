import "server-only";
import { cloudflareMedia } from "./runtime-scope";
// Strict container checks keep animation and metadata rules the same on both runtimes.
export function validateCloudflareImage(bytes: Buffer) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  if (!png && !webp) throw new Error("IMAGE_FORMAT");
  let offset = png ? 8 : 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("IMAGE_CONTAINER");
    const length = png
      ? bytes.readUInt32BE(offset)
      : bytes.readUInt32LE(offset + 4);
    const kind = bytes.toString(
      "ascii",
      offset + (png ? 4 : 0),
      offset + (png ? 8 : 4),
    );
    if (["acTL", "ANIM", "ANMF"].includes(kind))
      throw new Error("ANIMATED_IMAGE");
    const next = offset + 8 + length + (png ? 4 : length % 2);
    if (next > bytes.length || next <= offset)
      throw new Error("IMAGE_CONTAINER");
    offset = next;
  }
}
export async function normalizeImage(input: Buffer) {
  if (process.env.KIYA_RUNTIME === "cloudflare") {
    validateCloudflareImage(input);
    const { images } = cloudflareMedia();
    const stream = () =>
      new Response(new Uint8Array(input)).body! as unknown as Parameters<
        typeof images.info
      >[0];
    const meta = await images.info(stream());
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(meta.format) ||
      !("width" in meta) ||
      meta.width * meta.height > 25000000 ||
      meta.width < 200 ||
      meta.height < 200
    )
      throw new Error("IMAGE_DIMENSIONS");
    const transformed = await images
      .input(stream())
      .transform({ width: 1600, height: 1600, fit: "scale-down" })
      .output({ format: "image/webp", quality: 85, anim: false });
    const bytes = Buffer.from(await transformed.response().arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
      throw new Error("IMAGE_SIZE");
    validateCloudflareImage(bytes);
    // Never store a result carrying EXIF or XMP, even if provider defaults change.
    for (let at = 12; at + 8 <= bytes.length;) {
      const name = bytes.toString("ascii", at, at + 4),
        length = bytes.readUInt32LE(at + 4);
      if (name === "EXIF" || name === "XMP ") throw new Error("IMAGE_METADATA");
      at += 8 + length + (length % 2);
    }
    const info = await images.info(
      new Response(new Uint8Array(bytes)).body! as unknown as Parameters<
        typeof images.info
      >[0],
    );
    if (!("width" in info) || info.width < 200 || info.height < 200)
      throw new Error("IMAGE_DIMENSIONS");
    return { bytes, width: info.width, height: info.height };
  }
  const { default: sharp } = await import("sharp");
  const image = sharp(input, { limitInputPixels: 25000000, animated: false }),
    meta = await image.metadata();
  if (
    !["jpeg", "png", "webp"].includes(meta.format || "") ||
    (meta.pages || 1) > 1
  )
    throw new Error("IMAGE_FORMAT");
  const result = await image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  if (result.info.width < 200 || result.info.height < 200)
    throw new Error("IMAGE_DIMENSIONS");
  return {
    bytes: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}
