import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "./db";
import { requireStaff, session, permissions, limit } from "./auth";
import { ApiError } from "./http";
import { mediaDirectory as directory } from "./media-storage";
import { reauthorize } from "./product-workflow";
export async function uploadMedia(request: Request) {
  const actor = await requireStaff(request, "product:write");
  await limit("media:" + actor.user.id, 15, 3600);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new ApiError(415, "CONTENT_TYPE", "تصویر را با فرم فایل بفرستید.");
  const cap = 6 * 1024 * 1024;
  if (Number(request.headers.get("content-length") || 0) > cap)
    throw new ApiError(413, "IMAGE_SIZE", "حجم تصویر بیش از ۵ مگابایت است.");
  const reader = request.body?.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  if (reader)
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > cap) {
        await reader.cancel();
        throw new ApiError(413, "IMAGE_SIZE", "حجم تصویر بیش از حد مجاز است.");
      }
      parts.push(value);
    }
  let file: FormDataEntryValue | null;
  try {
    file = (
      await new Response(Buffer.concat(parts), {
        headers: { "Content-Type": request.headers.get("content-type")! },
      }).formData()
    ).get("file");
  } catch {
    throw new ApiError(422, "INVALID_IMAGE", "فایل معتبر نیست.");
  }
  if (
    !file ||
    typeof file === "string" ||
    file.size > 5 * 1024 * 1024 ||
    file.size === 0
  )
    throw new ApiError(
      422,
      "INVALID_IMAGE",
      "فقط یک فایل تصویر معتبر تا ۵ مگابایت بفرستید.",
    );
  let bytes: Buffer, width: number, height: number;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25000000,
      animated: false,
    });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      (meta.pages || 1) > 1
    )
      throw new Error("format");
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
    bytes = result.data;
    width = result.info.width;
    height = result.info.height;
    if (width < 200 || height < 200) throw new Error("dimensions");
  } catch {
    throw new ApiError(
      422,
      "INVALID_IMAGE",
      "JPG، PNG یا WebP ثابت، حداقل۲۰۰پیکسل و حداکثر۲۵مگاپیکسل مجاز است؛ SVG و فایل چندفریمی پذیرفته نمی‌شود.",
    );
  }
  const id = createHash("sha256").update(bytes).digest("hex");
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  try {
    await writeFile(join(directory(), id + ".webp"), bytes, {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if (!(e && typeof e === "object" && "code" in e && e.code === "EEXIST"))
      throw e;
  }
  await db().$transaction(async (tx) => {
    await reauthorize(tx, actor, "product:write");
    await tx.mediaAsset.upsert({
      where: { id },
      create: {
        id,
        width,
        height,
        bytes: bytes.length,
        createdBy: actor.user.id,
      },
      update: {},
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.user.id,
        action: "media:upload",
        resourceId: id,
        data: { bytes: bytes.length, width, height },
      },
    });
  });
  return { id, url: "/api/media/" + id, width, height };
}
export async function serveMedia(request: Request, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new ApiError(404, "NOT_FOUND", "تصویر پیدا نشد.");
  if (
    !(await db().mediaAsset.findUnique({ where: { id }, select: { id: true } }))
  )
    throw new ApiError(404, "NOT_FOUND", "تصویر پیدا نشد.");
  const published = await db().product.findFirst({
    where: {
      imagePath: "/api/media/" + id,
      status: "PUBLISHED",
      ...(process.env.APP_MODE !== "demo" ? { isDemo: false } : {}),
    },
    select: { id: true },
  });
  if (!published) {
    const current = await session(request);
    if (
      !current ||
      current.user.kind !== "STAFF" ||
      !current.mfaVerified ||
      !current.user.mfaEnabled ||
      !permissions(current).some((p) =>
        ["product:read", "product:write"].includes(p),
      )
    )
      throw new ApiError(404, "NOT_FOUND", "تصویر پیدا نشد.");
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(join(directory(), id + ".webp"));
  } catch {
    throw new ApiError(404, "NOT_FOUND", "فایل تصویر در دسترس نیست.");
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="kiya.webp"',
    },
  });
}
