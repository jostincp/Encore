// Simple test to see if server.ts can be imported
console.log('Starting Music Service diagnostic...');

try {
    console.log('Loading dotenv...');
    require('dotenv').config({ path: '../../.env' });
    console.log('✓ Dotenv loaded');

    console.log('Loading tsconfig-paths...');
    require('tsconfig-paths/register');
    console.log('✓ tsconfig-paths loaded');

    console.log('Attempting to load server.ts...');
    require('./src/server.ts');
    console.log('✓ Server loaded successfully');
} catch (error) {
    console.error('❌ ERROR CAUGHT:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
