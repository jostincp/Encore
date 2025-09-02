const fs = require('fs');
const path = require('path');

// Function to fix ApiResponse objects by adding timestamp
function fixApiResponses(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Pattern to match ApiResponse objects without timestamp
  const pattern = /({[^}]*success:\s*(?:true|false)[^}]*})\s*as\s*ApiResponse/g;
  
  content = content.replace(pattern, (match, responseObj) => {
    // Check if timestamp already exists
    if (responseObj.includes('timestamp:')) {
      return match; // Already has timestamp
    }
    
    // Add timestamp before the closing brace
    const fixedObj = responseObj.replace(/}$/, ',\n        timestamp: new Date()\n      }');
    return `${fixedObj} as ApiResponse`;
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ApiResponse objects in ${filePath}`);
}

// Fix both controller files
const controllersDir = path.join(__dirname, 'src', 'controllers');
const analyticsController = path.join(controllersDir, 'analyticsController.ts');
const eventsController = path.join(controllersDir, 'eventsController.ts');

if (fs.existsSync(analyticsController)) {
  fixApiResponses(analyticsController);
}

if (fs.existsSync(eventsController)) {
  fixApiResponses(eventsController);
}

console.log('All ApiResponse objects have been fixed!');