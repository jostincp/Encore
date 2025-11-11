const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-super-secret-jwt-key';

// Generate a valid JWT token for testing
const token = jwt.sign(
  { 
    userId: 'test-user-123',
    email: 'test@encore.com',
    role: 'bar_owner'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Generated JWT Token:');
console.log(token);
console.log('\nCopy this token for testing:');
