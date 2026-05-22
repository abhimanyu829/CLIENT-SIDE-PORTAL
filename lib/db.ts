import { PrismaClient } from "@prisma/client";

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// In Next.js build environment we mock the db to avoid connecting to the database
// when prerendering pages that don't need real data at build time
const mockDb = new Proxy({}, {
  get: (target, prop) => {
    if (prop === '$transaction') return async (arr: any) => [];
    
    // Return a proxy for any model (e.g., product, aIUsageLog, user, etc.)
    return new Proxy({}, {
      get: (modelTarget, method) => {
        return async () => {
          if (method === 'count') return 0;
          if (method === 'aggregate') return { _sum: {}, _avg: {}, _count: 0, _min: {}, _max: {} };
          if (method === 'groupBy') return [];
          if (method === 'findUnique' || method === 'findFirst') return null;
          // default for findMany, updateMany, etc.
          return [];
        };
      }
    });
  }
}) as any;

const isBuild = process.env.npm_lifecycle_event === 'build';

export const db = isBuild ? mockDb : (
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })
);

if (process.env.NODE_ENV !== "production" && !isBuild) {
  global.prisma = db;
}
