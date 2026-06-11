import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const isBuild = process.env.npm_lifecycle_event === "build";

// ── Build-time mock ───────────────────────────────────────────────────────────
// Prevents Prisma from connecting during `next build` static prerendering.
const mockDb = new Proxy({} as any, {
  get: (_t, prop) => {
    if (prop === "$transaction") return async (_arr: any) => [];
    return new Proxy({} as any, {
      get: (_m, method) =>
        async () => {
          if (method === "count") return 0;
          if (method === "aggregate") return { _sum: {}, _avg: {}, _count: 0, _min: {}, _max: {} };
          if (method === "groupBy") return [];
          if (method === "findUnique" || method === "findFirst") return null;
          return [];
        },
    });
  },
});

// ── Supabase cold-start detection ────────────────────────────────────────────
// Supabase free-tier pauses the DB after inactivity. The first query throws
// PrismaClientInitializationError with "Can't reach database server".
// We retry with backoff so Supabase has time to wake up before we surface an error.
function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as any;
  return (
    e?.code === "P1001" ||
    e?.code === "P1017" ||
    e?.constructor?.name === "PrismaClientInitializationError" ||
    (typeof e?.message === "string" &&
      (e.message.includes("Can't reach database server") ||
        e.message.includes("Connection refused") ||
        e.message.includes("ECONNREFUSED") ||
        e.message.includes("connect ETIMEDOUT")))
  );
}

// ── Retry-aware Prisma factory ────────────────────────────────────────────────
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    // Reduced log level — "query" floods the terminal in dev; use prisma studio or logs for query inspection
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1500; // 1.5s, 3s — gives Supabase ~4.5s total to wake

  // Wrap every model accessor (product, user, order, …) in a retry proxy
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Only proxy plain model objects, not $-prefixed internals or primitives
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof prop === "string" &&
        !prop.startsWith("$") &&
        !prop.startsWith("_")
      ) {
        return new Proxy(value as object, {
          get(modelTarget, method, modelReceiver) {
            const fn = Reflect.get(modelTarget, method, modelReceiver);
            if (typeof fn !== "function") return fn;

            return async (...args: unknown[]) => {
              let lastErr: unknown;
              for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                  return await (fn as Function).apply(modelTarget, args);
                } catch (err) {
                  lastErr = err;
                  if (isConnectionError(err) && attempt < MAX_RETRIES) {
                    const delay = attempt * BASE_DELAY_MS;
                    console.warn(
                      `[DB] ⚡ Supabase cold-start detected (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay}ms…`
                    );
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                  }
                  throw err;
                }
              }
              throw lastErr;
            };
          },
        });
      }

      return value;
    },
  }) as unknown as PrismaClient;
}

// ── Singleton (prevent multiple connections in Next.js dev HMR) ───────────────
export const db: PrismaClient = isBuild
  ? mockDb
  : (global.prisma ?? (global.prisma = createPrismaClient()));
