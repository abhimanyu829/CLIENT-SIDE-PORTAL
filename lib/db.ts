import { PrismaClient } from "@prisma/client";

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// In Next.js build environment we mock the db to avoid connecting to the database
// when prerendering pages that don't need real data at build time
const mockDb = {
  product: {
    findMany: async () => [],
    count: async () => 0,
    findUnique: async () => null,
  },
  blogPost: {
    findMany: async () => [],
    findUnique: async () => null,
  },
  productReview: {
    findMany: async () => [],
  },
  $transaction: async (arr: any) => [],
} as any;

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
