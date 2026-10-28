import "server-only";
// Sharp runs the same pipeline locally and on any Node host; animated or
// non-standard containers are rejected rather than silently flattened.
export async function normalizeImage(input: Buffer) {
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
