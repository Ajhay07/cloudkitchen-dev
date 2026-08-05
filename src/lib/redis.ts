import type { ConnectionOptions } from 'bullmq';

/**
 * REDIS_URL was documented (.env.example, README, SETUP.md) but never
 * actually wired up — every BullMQ Queue/Worker hardcoded
 * REDIS_HOST/REDIS_PORT (undocumented, defaulting to localhost:6379).
 *
 * This exports connection OPTIONS, not a shared ioredis instance — BullMQ
 * internally calls `.duplicate()` on whatever connection it's given (for its
 * blocking/subscriber clients), and against this Upstash instance the
 * duplicated connection connects but never responds to any command (hangs
 * forever — verified directly). Passing plain options instead means BullMQ
 * creates its own fresh ioredis connections per Queue/Worker rather than
 * duplicating a pre-existing one, which avoids the hang entirely.
 */
function parseRedisUrl(): ConnectionOptions {
  const raw = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
  const url = new URL(raw);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null, // required by BullMQ Workers
  };
}

export const redisConnection: ConnectionOptions = parseRedisUrl();
