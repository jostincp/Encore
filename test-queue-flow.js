const axios = require('axios');

// Test the complete queue flow with points validation
async function testQueueFlow() {
  console.log('🧪 Testing Queue Flow with Points Validation...\n');
  
  try {
    // 1. Login to get auth token
    console.log('1. 🔑 Login to get auth token...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@encore.com',
      password: 'password123'
    });
    
    const authToken = loginResponse.data.token;
    const userId = loginResponse.data.user.id;
    console.log(`✅ Login successful. User ID: ${userId}`);
    console.log(`   Token: ${authToken.substring(0, 20)}...\n`);
    
    // 2. Check user points
    console.log('2. 💰 Check user points...');
    const pointsResponse = await axios.get(`http://localhost:3002/api/points/user/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const userPoints = pointsResponse.data.points;
    console.log(`✅ User has ${userPoints} points\n`);
    
    // 3. Test adding song to queue (should fail if insufficient points)
    console.log('3. 🎵 Test adding song to queue...');
    
    const testSong = {
      song_id: '123e4567-e89b-12d3-a456-426614174001',
      bar_id: 'default-bar',
      priority_play: false,
      points_used: 50
    };
    
    try {
      const queueResponse = await axios.post('http://localhost:3003/api/queue/add', testSong, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Song added to queue successfully!');
      console.log(`   Position: ${queueResponse.data.data.position}`);
      console.log(`   Points used: ${queueResponse.data.data.points_used}\n`);
      
    } catch (error) {
      if (error.response?.status === 402) {
        console.log('❌ Payment Required - Insufficient points');
        console.log(`   Error: ${error.response.data.message}`);
        console.log(`   Required: ${error.response.data.required_points}`);
        console.log(`   Available: ${error.response.data.current_balance}\n`);
      } else if (error.response?.status === 409) {
        console.log('❌ Conflict - Song already in queue');
        console.log(`   Error: ${error.response.data.message}\n`);
      } else {
        console.log('❌ Error adding song to queue:');
        console.log(`   Status: ${error.response?.status}`);
        console.log(`   Message: ${error.response?.data?.message || error.message}\n`);
      }
    }
    
    // 4. Test priority play (should cost more points)
    console.log('4. ⚡ Test priority play (costs 100 points)...');
    
    const prioritySong = {
      song_id: '123e4567-e89b-12d3-a456-426614174002',
      bar_id: 'default-bar',
      priority_play: true,
      points_used: 100
    };
    
    try {
      const priorityResponse = await axios.post('http://localhost:3003/api/queue/add', prioritySong, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Priority song added to queue successfully!');
      console.log(`   Position: ${priorityResponse.data.data.position}`);
      console.log(`   Points used: ${priorityResponse.data.data.points_used}\n`);
      
    } catch (error) {
      if (error.response?.status === 402) {
        console.log('❌ Payment Required - Insufficient points for priority play');
        console.log(`   Error: ${error.response.data.message}`);
        console.log(`   Required: ${error.response.data.required_points}`);
        console.log(`   Available: ${error.response.data.current_balance}\n`);
      } else {
        console.log('❌ Error adding priority song to queue:');
        console.log(`   Status: ${error.response?.status}`);
        console.log(`   Message: ${error.response?.data?.message || error.message}\n`);
      }
    }
    
    console.log('🎉 Queue flow test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
testQueueFlow();