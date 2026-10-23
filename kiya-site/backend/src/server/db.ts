import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { workerScope } from "./runtime-scope";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { kiyaDb?: PrismaClient };
export function db(): PrismaClient {
  const scope = workerScope();
  if (scope) {
    if (!scope.env.DATABASE_URL) throw new Error("DATABASE_UNCONFIGURED");
    if (!scope.db) {
      const client = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: scope.env.DATABASE_URL,
          max: 2,
        }),
        log: [],
      });
      scope.db = client;
      scope.disposers.push(() => client.$disconnect());
    }
    return scope.db as PrismaClient;
  }
  if (process.env.KIYA_RUNTIME === "cloudflare")
    throw new Error("CLOUDFLARE_REQUEST_SCOPE_MISSING");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_UNCONFIGURED");
  if (!globalDb.kiyaDb)
    globalDb.kiyaDb = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 5,
      }),
      log: [],
    });
  return globalDb.kiyaDb;
}
export type Transaction = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];
