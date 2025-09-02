const express = require('express');
const app = express();

console.log('Testing specific route that might cause path-to-regexp error...');

try {
  console.log('Testing: /range/:startDate/:endDate');
  app.get('/range/:startDate/:endDate', (req, res) => {
    res.json({ message: 'success' });
  });
  console.log('✓ Route /range/:startDate/:endDate compiled successfully');
} catch (error) {
  console.error('✗ Route /range/:startDate/:endDate failed:', error.message);
  console.error('Stack:', error.stack);
}

try {
  console.log('Testing: /user/:userId/events');
  app.get('/user/:userId/events', (req, res) => {
    res.json({ message: 'success' });
  });
  console.log('✓ Route /user/:userId/events compiled successfully');
} catch (error) {
  console.error('✗ Route /user/:userId/events failed:', error.message);
  console.error('Stack:', error.stack);
}

try {
  console.log('Testing: /session/:sessionId/events');
  app.get('/session/:sessionId/events', (req, res) => {
    res.json({ message: 'success' });
  });
  console.log('✓ Route /session/:sessionId/events compiled successfully');
} catch (error) {
  console.error('✗ Route /session/:sessionId/events failed:', error.message);
  console.error('Stack:', error.stack);
}

// Test if we can start the server
try {
  console.log('Testing server startup...');
  const server = app.listen(0, () => {
    console.log('✓ Server started successfully');
    server.close();
  });
} catch (error) {
  console.error('✗ Server startup failed:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\nTesting complete.');