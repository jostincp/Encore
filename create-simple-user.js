const axios = require('axios');

async function createTestUser() {
  try {
    console.log('👤 Creating test user via register-user...');
    
    // Register as customer
    const userResponse = await axios.post('http://localhost:3001/api/auth/register-user', {
      email: 'test@encore.com',
      password: 'password123',
      first_name: 'Test',
      last_name: 'User',
      phone: '+1234567890'
    });
    
    console.log('✅ Test user created:', userResponse.data.user.id);
    
    // Login to get token
    console.log('🔐 Logging in as test user...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@encore.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    const userId = loginResponse.data.user.id;
    
    console.log('✅ Login successful!');
    
    // Add points to the user
    console.log('💰 Adding initial points...');
    const pointsResponse = await axios.post('http://localhost:3002/api/points/add', {
      user_id: userId,
      points: 200,
      reason: 'Initial test points'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Added 200 points to user');
    
    console.log('🎉 Test user ready!');
    console.log('📧 Email: test@encore.com');
    console.log('🔑 Password: password123');
    console.log('💰 Points: 200');
    console.log('🎫 Token:', token);
    
    return token;
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    // If user already exists, try to login
    if (error.response?.data?.error?.includes('already exists')) {
      console.log('🔄 User already exists, trying to login...');
      try {
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
          email: 'test@encore.com',
          password: 'password123'
        });
        
        console.log('✅ Login successful!');
        return loginResponse.data.token;
      } catch (loginError) {
        console.error('❌ Login failed:', loginError.response?.data || loginError.message);
      }
    }
    
    process.exit(1);
  }
}

createTestUser();