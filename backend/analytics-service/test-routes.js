const express = require('express');
const app = express();

// Test simple routes
app.get('/test', (req, res) => {
  res.json({ message: 'Test route works' });
});

// Test route with parameter
app.get('/test/:id', (req, res) => {
  res.json({ message: 'Test route with parameter works', id: req.params.id });
});

// Test route with multiple parameters
app.get('/test/:year/:month', (req, res) => {
  res.json({ message: 'Test route with multiple parameters works', year: req.params.year, month: req.params.month });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});