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
// Supabase free-tier pauses the DB after inactivity. Errors vary by Prisma
// version and connection type. Match all known patterns.
function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as any;
  if (
    e?.code === "P1001" ||
    e?.code === "P1017" ||
    e?.code === "P1002" ||
    e?.constructor?.name === "PrismaClientInitializationError"
  ) return true;
  if (typeof e?.message === "string") {
    const m = e.message;
    return (
      m.includes("Can't reach database server") ||
      m.includes("Connection refused") ||
      m.includes("ECONNREFUSED") ||
      m.includes("ENOTFOUND") ||
      m.includes("connect ETIMEDOUT") ||
      m.includes("ETIMEDOUT") ||
      m.includes("socket closed") ||
      m.includes("Connection timed out") ||
      m.includes("Error querying the database")
    );
  }
  return false;
}

// ── Supabase REST wake-up ping ────────────────────────────────────────────────
// Hitting the Supabase REST endpoint forces the DB out of pause/sleep mode.
// This is faster than waiting for TCP to time out and retry.
let wakeAttempted = false;
async function wakeSupabase(): Promise<void> {
  if (wakeAttempted) return;
  wakeAttempted = true;
  try {
    // Extract project ref from DATABASE_URL
    const url = process.env.DATABASE_URL ?? "";
    const match = url.match(/db\.([a-z0-9]+)\.supabase\.co/);
    const ref = match?.[1];
    if (!ref) return;

    // Supabase REST API — any request wakes the DB
    const restUrl = `https://${ref}.supabase.co/rest/v1/`;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    console.log("[DB] 🔔 Pinging Supabase REST to wake DB…");
    await fetch(restUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Ignore — wake ping is best-effort
  }
}

// ── Retry-aware Prisma factory ────────────────────────────────────────────────
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 2000; // 2s, 4s, 8s, 16s — gives Supabase ~30s total

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
                    // On first failure, ping Supabase REST to wake the DB
                    if (attempt === 1) {
                      void wakeSupabase();
                    }
                    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 16_000);
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
