import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { kiyaDb?: PrismaClient };
export function db(): PrismaClient {
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
