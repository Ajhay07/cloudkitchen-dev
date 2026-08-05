import IORedis from 'ioredis';

/**
 * REDIS_URL was documented (.env.example, README, SETUP.md) but never
 * actually wired up — every BullMQ Queue/Worker hardcoded
 * REDIS_HOST/REDIS_PORT (undocumented, defaulting to localhost:6379)
 * instead. This is the single shared connection every queue/worker now uses.
 */
function buildRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  return `redis://${host}:${port}`;
}

declare global {
  // eslint-disable-next-line no-var
  var __redisConnection: IORedis | undefined;
}

// Reused across hot-reloads in dev, and shared by every Queue/Worker/QueueEvents
// instance in the app rather than each opening its own connection.
export const redisConnection: IORedis =
  global.__redisConnection ??
  new IORedis(buildRedisUrl(), {
    // Required by BullMQ Workers — see https://docs.bullmq.io/guide/going-to-production#maxretriesperrequest
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__redisConnection = redisConnection;
}
