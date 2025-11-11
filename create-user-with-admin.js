const axios = require('axios');

async function createTestUserWithAdmin() {
  try {
    console.log('🔐 Logging in as admin...');
    
    // Login as admin
    const adminLogin = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@encore.com',
      password: 'Password123!'
    });
    
    const adminToken = adminLogin.data.token;
    console.log('✅ Admin login successful!');
    
    // Create test user
    console.log('👤 Creating test user...');
    const userResponse = await axios.post('http://localhost:3001/api/users', {
      email: 'test@encore.com',
      password: 'password123',
      first_name: 'Test',
      last_name: 'User',
      phone: '+1234567890',
      role: 'customer'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log('✅ Test user created:', userResponse.data.user.id);
    
    // Add points to the user
    console.log('💰 Adding initial points...');
    const pointsResponse = await axios.post('http://localhost:3002/api/points/add', {
      user_id: userResponse.data.user.id,
      points: 200,
      reason: 'Initial test points'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log('✅ Added 200 points to user');
    
    // Login as test user to get token
    console.log('🔐 Logging in as test user...');
    const userLogin = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@encore.com',
      password: 'password123'
    });
    
    console.log('🎉 Test user ready!');
    console.log('📧 Email: test@encore.com');
    console.log('🔑 Password: password123');
    console.log('💰 Points: 200');
    console.log('🎫 Token:', userLogin.data.token);
    
    return userLogin.data.token;
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

createTestUserWithAdmin();