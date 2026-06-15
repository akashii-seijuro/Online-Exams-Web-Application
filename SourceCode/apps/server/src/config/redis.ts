import { Redis } from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 100, 2_000);
  }
});

redis.on("connect", () => {
  logger.info("Redis connection established", { source: "redis" });
});

redis.on("error", (error) => {
  logger.error("Redis connection error", { error, source: "redis" });
});

export async function checkRedisConnection() {
  await redis.ping();
}

export async function disconnectRedis() {
  if (redis.status !== "end") {
    redis.disconnect();
  }
}
