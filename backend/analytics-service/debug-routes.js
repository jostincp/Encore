const { pathToRegexp } = require('path-to-regexp');
const fs = require('fs');
const path = require('path');

console.log('Testing route patterns with path-to-regexp...');

// Read route files and extract route patterns
const routeFiles = [
  'src/routes/analytics.ts',
  'src/routes/events.ts', 
  'src/routes/reports.ts',
  'src/routes/index.ts'
];

const routePatterns = [];

for (const file of routeFiles) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Extract route patterns using regex
    const routeRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\s*,/g;
    let match;
    
    while ((match = routeRegex.exec(content)) !== null) {
      const pattern = match[2];
      routePatterns.push({ file, pattern, method: match[1] });
    }
    
    console.log(`✓ Extracted routes from ${file}`);
  } catch (error) {
    console.log(`✗ Failed to read ${file}: ${error.message}`);
  }
}

console.log(`\nFound ${routePatterns.length} route patterns. Testing each one...\n`);

// Test each route pattern
for (const { file, pattern, method } of routePatterns) {
  try {
    console.log(`Testing: ${method.toUpperCase()} ${pattern} (from ${file})`);
    
    // Try to compile the route pattern
    const regexp = pathToRegexp(pattern);
    
    console.log(`  ✓ Pattern compiled successfully`);
    
  } catch (error) {
    console.log(`  ✗ ERROR: ${error.message}`);
    
    if (error.message.includes('Missing parameter name')) {
      console.log(`\n🎯 FOUND THE PROBLEM!`);
      console.log(`  File: ${file}`);
      console.log(`  Pattern: ${pattern}`);
      console.log(`  Method: ${method.toUpperCase()}`);
      console.log(`  Error: ${error.message}`);
      process.exit(1);
    }
  }
}

console.log('\n✅ All route patterns tested successfully!');
console.log('The path-to-regexp error might be coming from a different source.');
process.exit(0);