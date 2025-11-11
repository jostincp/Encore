const axios = require('axios');

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    const response = await axios.post('http://localhost:3001/api/auth/register-user', {
      email: 'test@encore.com',
      password: 'password123',
      first_name: 'Test',
      last_name: 'User',
      phone: '+1234567890'
    });
    
    console.log('✅ User created successfully!');
    console.log('User ID:', response.data.user.id);
    console.log('Email:', response.data.user.email);
    
    // Add some initial points to the user
    const userId = response.data.user.id;
    const pointsResponse = await axios.post('http://localhost:3002/api/points/add', {
      user_id: userId,
      points: 200,
      reason: 'Initial test points'
    }, {
      headers: { Authorization: `Bearer ${response.data.token}` }
    });
    
    console.log('✅ Added 200 test points to user');
    console.log('Current points:', pointsResponse.data.new_balance);
    
    return {
      userId,
      token: response.data.token,
      email: response.data.user.email
    };
    
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
      console.log('User already exists, trying to login...');
      
      const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        email: 'test@encore.com',
        password: 'password123'
      });
      
      console.log('✅ Login successful!');
      
      // Add some initial points to the user
      const userId = loginResponse.data.user.id;
      const pointsResponse = await axios.post('http://localhost:3002/api/points/add', {
        user_id: userId,
        points: 200,
        reason: 'Initial test points'
      }, {
        headers: { Authorization: `Bearer ${loginResponse.data.token}` }
      });
      
      console.log('✅ Added 200 test points to user');
      
      return {
        userId,
        token: loginResponse.data.token,
        email: loginResponse.data.user.email
      };
    }
    
    console.error('Error creating user:', error.response?.data || error.message);
    throw error;
  }
}

// Run the creation
createTestUser()
  .then(user => {
    console.log('\n🎉 Test user ready!');
    console.log('User ID:', user.userId);
    console.log('Token:', user.token.substring(0, 50) + '...');
  })
  .catch(error => {
    console.error('Failed to create test user:', error.message);
    process.exit(1);
  });