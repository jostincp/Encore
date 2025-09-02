const express = require('express');

// Test the specific problematic route
const app = express();

try {
  console.log('Testing route: /range/:startDate/:endDate');
  app.get('/range/:startDate/:endDate', (req, res) => {
    res.json({ success: true });
  });
  console.log('✓ Route /range/:startDate/:endDate is valid');
} catch (error) {
  console.error('✗ Error with route /range/:startDate/:endDate:', error.message);
  if (error.message.includes('Missing parameter name')) {
    console.error('Found the problematic route!');
  }
}

// Test other suspicious routes
const testRoutes = [
  '/timeseries/:metricName',
  '/weekly/:year/:week',
  '/monthly/:year/:month',
  '/user/:userId/events',
  '/session/:sessionId/events',
  '/:id'
];

testRoutes.forEach(route => {
  try {
    console.log(`Testing route: ${route}`);
    const testApp = express();
    testApp.get(route, (req, res) => {
      res.json({ success: true });
    });
    console.log(`✓ Route ${route} is valid`);
  } catch (error) {
    console.error(`✗ Error with route ${route}:`, error.message);
    if (error.message.includes('Missing parameter name')) {
      console.error(`Found the problematic route: ${route}`);
    }
  }
});

console.log('Route testing completed.');

// Test the actual route compilation issue
try {
  console.log('\nTesting path-to-regexp directly...');
  const pathToRegexp = require('path-to-regexp');
  
  const problematicRoutes = [
    '/range/:startDate/:endDate',
    '/timeseries/:metricName',
    '/weekly/:year/:week',
    '/monthly/:year/:month'
  ];
  
  problematicRoutes.forEach(route => {
    try {
      console.log(`Testing path-to-regexp compilation for: ${route}`);
      const keys = [];
      const regexp = pathToRegexp.pathToRegexp(route, keys);
      console.log(`✓ ${route} compiled successfully`);
      console.log(`  Keys: ${keys.map(k => k.name).join(', ')}`);
    } catch (error) {
      console.error(`✗ Error compiling ${route}:`, error.message);
      if (error.message.includes('Missing parameter name')) {
        console.error(`FOUND THE PROBLEMATIC ROUTE: ${route}`);
      }
    }
  });
} catch (error) {
  console.error('Error loading path