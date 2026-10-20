const assert = require('node:assert/strict');
const { redisGet, redisSet, closeRedis, redisConfigured } = require('../dist/services/redis');
(async () => {
  delete process.env.REDIS_URL;
  delete process.env.REDIS_CLUSTER_NODES;
  assert.equal(redisConfigured(), false);
  assert.equal(await redisGet('missing'), null);
  process.env.REDIS_CLUSTER_NODES = 'redis://127.0.0.1:1';
  process.env.REDIS_CONNECT_TIMEOUT_MS = '100';
  assert.equal(redisConfigured(), true);
  assert.equal(await redisGet('missing'), null);
  await redisSet('missing', 'value', 1000);
  closeRedis();
  console.log('PASS: disabled Redis and unavailable cluster safely fall back');
})().catch(() => { closeRedis(); process.exitCode = 1; console.error('Redis fallback test failed'); });
