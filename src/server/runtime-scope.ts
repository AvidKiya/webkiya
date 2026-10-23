import "server-only";
import type { R2Bucket, ImagesBinding } from "@cloudflare/workers-types/index";
export type WorkerScope = {
  env: { DATABASE_URL?: string; KIYA_MEDIA?: R2Bucket; IMAGES?: ImagesBinding };
  db?: unknown;
  disposers: (() => Promise<void>)[];
};
export function workerScope() {
  return (
    globalThis as unknown as Record<
      symbol,
      { getStore: () => WorkerScope | undefined }
    >
  )[Symbol.for("kiya.cloudflare.scope")]?.getStore();
}
export function cloudflareMedia() {
  const env = workerScope()?.env;
  if (!env?.KIYA_MEDIA || !env.IMAGES)
    throw new Error("CLOUDFLARE_MEDIA_UNCONFIGURED");
  return { bucket: env.KIYA_MEDIA, images: env.IMAGES };
}
