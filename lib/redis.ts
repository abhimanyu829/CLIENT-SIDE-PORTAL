import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

let redis: Redis | null = null;

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
} else if (env.REDIS_URL) {
  redis = new Redis({
    url: env.REDIS_URL,
    token: "",
  });
} else {
  // Redis is optional for local development — rate limiting and queues are disabled
  console.warn(
    "⚠️  Redis not configured. Rate limiting and BullMQ queues are disabled."
  );
}

export { redis };
