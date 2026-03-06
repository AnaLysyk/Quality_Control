const { Redis } = require('@upstash/redis');

(async ()=>{
  try {
    const redis = Redis.fromEnv();
    console.log('Redis client initialized');
    await redis.set('tmp_smoke_key', 'ok-from-smoke');
    const v = await redis.get('tmp_smoke_key');
    console.log('SMOKE VALUE:', v);
  } catch (e) {
    console.error('SMOKE ERROR', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
