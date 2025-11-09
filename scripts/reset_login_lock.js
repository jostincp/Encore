const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('redis');

// Load monorepo root .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const emailArg = process.argv[2] || 'jostin02castillo@gmail.com';
const email = String(emailArg).trim().toLowerCase();

const redisUrl = process.env.REDIS_URL || (
  'redis://' + (process.env.REDIS_HOST || '127.0.0.1') + ':' + (process.env.REDIS_PORT || '6379')
);

async function main() {
  const client = createClient({ url: redisUrl });
  client.on('error', (e) => console.error('Redis error:', e));
  await client.connect();

  const keys = [
    'login:lock:' + email,
    'login:attempts:' + email,
    'login:lock_stage:' + email,
  ];

  const vals = await Promise.all(keys.map((k) => client.get(k)));
  const ttls = await Promise.all(keys.map((k) => client.ttl(k)));
  console.log('Antes', { keys, vals, ttls, redisUrl });

  const hasLocks = vals.some((v) => v !== null) || ttls.some((t) => (typeof t === 'number' ? t > 0 : false));
  if (hasLocks) {
    await client.del(keys);
    console.log('Bloqueos eliminados');
  } else {
    console.log('No hay bloqueos activos');
  }

  const afterVals = await Promise.all(keys.map((k) => client.get(k)));
  const afterTtls = await Promise.all(keys.map((k) => client.ttl(k)));
  console.log('Después', { afterVals, afterTtls });

  await client.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});