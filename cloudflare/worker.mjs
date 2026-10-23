import { AsyncLocalStorage } from "node:async_hooks";
import { Client } from "pg";
import { CloudflareSocket } from "../node_modules/pg-cloudflare/dist/index.js";
globalThis[Symbol.for("kiya.pg.socket")] = CloudflareSocket;
import compiler from "../.data/cloudflare-query-compiler.wasm";
globalThis[Symbol.for("kiya.prisma.compiler")] = compiler;
import application from "../.open-next/worker.js";
const key = Symbol.for("kiya.cloudflare.scope");
const storage = (globalThis[key] ??= new AsyncLocalStorage());
const worker = {
  async fetch(request, env, ctx) {
    const scope = { env, disposers: [] };
    return storage.run(scope, async () => {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        ctx.waitUntil(
          Promise.allSettled(scope.disposers.map((dispose) => dispose())),
        );
      };
      try {
        const response = await application.fetch(request, env, ctx);
        if (!response.body) {
          close();
          return response;
        }
        const reader = response.body.getReader();
        const body = new ReadableStream({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                close();
              } else controller.enqueue(value);
            } catch {
              close();
              controller.error(new Error("Response stream failed"));
            }
          },
          async cancel(reason) {
            try {
              await reader.cancel(reason);
            } finally {
              close();
            }
          },
        });
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        close();
        throw new Error("Application request failed");
      }
    });
  },
  async scheduled(_event, env) {
    if (!env.DATABASE_URL) throw new Error("DATABASE_UNCONFIGURED");
    const client = new Client({ connectionString: env.DATABASE_URL });
    try {
      await client.connect();
      const due = await client.query(
        'SELECT id FROM "PurchaseOrder" WHERE status=\'RESERVED\' AND "reservedUntil"<=clock_timestamp() ORDER BY "reservedUntil",id LIMIT 100',
      );
      for (const row of due.rows)
        await client.query(
          "SELECT kiya_release_order($1::uuid,'EXPIRED',NULL)",
          [row.id],
        );
    } catch {
      throw new Error("Reservation maintenance failed");
    } finally {
      await client.end();
    }
  },
};

export default worker;
