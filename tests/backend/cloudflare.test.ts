import { afterEach, expect, test, vi } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { db } from "../../src/server/db";
import { workerScope, type WorkerScope } from "../../src/server/runtime-scope";
import { storeMedia, loadMedia } from "../../src/server/media-storage";
import {
  normalizeImage,
  validateCloudflareImage,
} from "../../src/server/image-processing";
const key = Symbol.for("kiya.cloudflare.scope");
const globals = globalThis as unknown as Record<
  symbol,
  AsyncLocalStorage<WorkerScope>
>;
const previous = globals[key];
const runtime = process.env.KIYA_RUNTIME;
afterEach(() => {
  if (previous) globals[key] = previous;
  else delete globals[key];
  if (runtime === undefined) delete process.env.KIYA_RUNTIME;
  else process.env.KIYA_RUNTIME = runtime;
  vi.unstubAllEnvs();
});
function storage() {
  process.env.KIYA_RUNTIME = "cloudflare";
  return (globals[key] = new AsyncLocalStorage<WorkerScope>());
}
test("Workers refuses fallback to a process-global Node database outside request scope", () => {
  storage();
  expect(workerScope()).toBeUndefined();
  expect(() => db()).toThrow("CLOUDFLARE_REQUEST_SCOPE_MISSING");
});
test("Workers database clients are request-isolated, reused within scope, and explicitly disposable", async () => {
  const local = storage();
  const instances = new Set();
  await Promise.all(
    [1, 2, 3].map(() =>
      local.run(
        { env: { DATABASE_URL: process.env.TEST_DATABASE_URL }, disposers: [] },
        async () => {
          const scope = workerScope()!;
          const client = db();
          instances.add(client);
          try {
            expect(db()).toBe(client);
            expect(scope.disposers).toHaveLength(1);
            expect(await client.$queryRaw`SELECT 1 AS n`).toEqual([{ n: 1 }]);
          } finally {
            await Promise.all(scope.disposers.map((dispose) => dispose()));
          }
        },
      ),
    ),
  );
  expect(instances.size).toBe(3);
});
test("Workers persists media in private R2, not ephemeral filesystem", async () => {
  const objects = new Map<string, Uint8Array>();
  const put = vi.fn(async (k: string, b: Uint8Array) => {
    objects.set(k, b);
  });
  const get = vi.fn(async (k: string) =>
    objects.has(k)
      ? { arrayBuffer: async () => objects.get(k)!.slice().buffer }
      : null,
  );
  const local = storage();
  vi.stubEnv("MEDIA_ROOT", ".data/should-never-be-written-by-worker");
  await local.run(
    {
      env: {
        KIYA_MEDIA: { put, get } as unknown as NonNullable<
          WorkerScope["env"]["KIYA_MEDIA"]
        >,
        IMAGES: {} as NonNullable<WorkerScope["env"]["IMAGES"]>,
      },
      disposers: [],
    },
    async () => {
      await storeMedia("a".repeat(64), Buffer.from("normalized-image"));
      expect(await loadMedia("a".repeat(64))).toEqual(
        Buffer.from("normalized-image"),
      );
      await expect(loadMedia("b".repeat(64))).rejects.toThrow(
        "MEDIA_NOT_FOUND",
      );
      expect(put.mock.calls[0][0]).toBe("media/" + "a".repeat(64) + ".webp");
      expect(existsSync(process.env.MEDIA_ROOT!)).toBe(false);
    },
  );
});
test("Workers media fails closed without both configured bindings", async () => {
  const local = storage();
  await local.run({ env: {}, disposers: [] }, async () => {
    await expect(storeMedia("a".repeat(64), Buffer.from("x"))).rejects.toThrow(
      "CLOUDFLARE_MEDIA_UNCONFIGURED",
    );
  });
});
test("Workers image container preflight rejects animation, unsupported formats and corrupt chunks", async () => {
  expect(() => validateCloudflareImage(Buffer.from("<svg/>"))).toThrow(
    "IMAGE_FORMAT",
  );
  const animated = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.alloc(4),
    Buffer.from("acTL"),
    Buffer.alloc(4),
  ]);
  expect(() => validateCloudflareImage(animated)).toThrow("ANIMATED_IMAGE");
  expect(() => validateCloudflareImage(animated.subarray(0, 10))).toThrow(
    "IMAGE_CONTAINER",
  );
  const input = await sharp({
    create: { width: 250, height: 250, channels: 3, background: "#abcdef" },
  })
    .webp()
    .toBuffer();
  expect(() => validateCloudflareImage(input)).not.toThrow();
});
test("Workers image processing verifies dimensions, strips metadata and requests a single-frame bounded WebP", async () => {
  const input = await sharp({
    create: { width: 300, height: 250, channels: 3, background: "#abc" },
  })
    .png()
    .toBuffer();
  const bytes = await sharp(input).webp({ quality: 85 }).toBuffer();
  const transform = vi.fn();
  const output = vi.fn(async () => ({
    response: () => new Response(new Uint8Array(bytes)),
  }));
  const info = vi.fn(async () => ({
    format: "image/webp",
    width: 300,
    height: 250,
  }));
  transform.mockReturnValue({ output });
  const local = storage();
  await local.run(
    {
      env: {
        KIYA_MEDIA: {} as NonNullable<WorkerScope["env"]["KIYA_MEDIA"]>,
        IMAGES: {
          info,
          input: () => ({ transform }),
        } as unknown as NonNullable<WorkerScope["env"]["IMAGES"]>,
      },
      disposers: [],
    },
    async () => {
      const result = await normalizeImage(input);
      expect(result).toEqual({ bytes, width: 300, height: 250 });
      expect(transform).toHaveBeenCalledWith({
        width: 1600,
        height: 1600,
        fit: "scale-down",
      });
      expect(output).toHaveBeenCalledWith({
        format: "image/webp",
        quality: 85,
        anim: false,
      });
    },
  );
});
