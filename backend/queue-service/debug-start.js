try {
  require('ts-node/register/transpile-only');
  require('tsconfig-paths/register');
  console.log('Starting queue-service via debug-start.js...');
  require('./src/server.ts');
} catch (e) {
  console.error('Startup error:', e && e.stack ? e.stack : e);
  process.exit(1);
}