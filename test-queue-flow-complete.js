const axios = require('axios');

async function testQueueFlow() {
  try {
    console.log('🔐 Logging in as admin...');
    
    // Login as admin
    const adminLogin = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@encore.com',
      password: 'Password123!'
    });
    
    const adminToken = adminLogin.data.token;
    console.log('✅ Admin login successful!');
    
    // Get or create a bar
    console.log('🏪 Getting bars...');
    const barsResponse = await axios.get('http://localhost:3001/api/bars', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    let barId;
    if (barsResponse.data.bars.length > 0) {
      barId = barsResponse.data.bars[0].id;
      console.log('✅ Using existing bar:', barId);
    } else {
      // Create a bar
      console.log('🏪 Creating test bar...');
      const barResponse = await axios.post('http://localhost:3001/api/bars', {
        name: 'Test Bar',
        address: 'Test Address 123',
        phone: '+1234567890',
        email: 'bar@test.com'
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      barId = barResponse.data.bar.id;
      console.log('✅ Created bar:', barId);
    }
    
    // Create test user
    console.log('👤 Creating test user...');
    try {
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
    } catch (userError) {
      if (userError.response?.data?.error?.includes('already exists')) {
        console.log('🔄 User already exists, continuing...');
      } else {
        throw userError;
      }
    }
    
    // Login as test user
    console.log('🔐 Logging in as test user...');
    const userLogin = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@encore.com',
      password: 'password123'
    });
    
    const userToken = userLogin.data.token;
    const userId = userLogin.data.user.id;
    console.log('✅ User login successful!');
    
    // Add points to user
    console.log('💰 Adding points to user...');
    await axios.post('http://localhost:3002/api/points/add', {
      user_id: userId,
      points: 200,
      reason: 'Test points'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Added 200 points');
    
    // Test 1: Add song with insufficient points
    console.log('\n🎵 Test 1: Adding song with insufficient points...');
    try {
      await axios.post('http://localhost:3002/api/queue/add', {
        bar_id: barId,
        song_id: 'spotify:track:1234567890',
        priority: false
      }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      console.log('❌ Should have failed with 402');
    } catch (error) {
      if (error.response?.status === 402) {
        console.log('✅ Correctly failed with 402 (Payment Required)');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }
    
    // Add more points
    console.log('\n💰 Adding more points...');
    await axios.post('http://localhost:3002/api/points/add', {
      user_id: userId,
      points: 500,
      reason: 'More test points'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Added 500 more points');
    
    // Test 2: Add song successfully
    console.log('\n🎵 Test 2: Adding song with sufficient points...');
    try {
      const addResponse = await axios.post('http://localhost:3002/api/queue/add', {
        bar_id: barId,
        song_id: 'spotify:track:1234567890',
        title: 'Test Song 1',
        artist: 'Test Artist',
        album: 'Test Album',
        duration_ms: 180000,
        album_cover: 'https://example.com/cover.jpg',
        priority: false
      }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      console.log('✅ Song added successfully:', addResponse.data);
    } catch (error) {
      console.log('❌ Failed to add song:', error.response?.status, error.response?.data);
    }
    
    // Test 3: Add same song again (should fail with 409)
    console.log('\n🎵 Test 3: Adding same song again (should fail with 409)...');
    try {
      await axios.post('http://localhost:3002/api/queue/add', {
        bar_id: barId,
        song_id: 'spotify:track:1234567890',
        title: 'Test Song 1',
        artist: 'Test Artist',
        album: 'Test Album',
        duration_ms: 180000,
        album_cover: 'https://example.com/cover.jpg',
        priority: false
      }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      console.log('❌ Should have failed with 409');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('✅ Correctly failed with 409 (Conflict) - Song already in queue');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }
    
    // Test 4: Add different song with priority
    console.log('\n🎵 Test 4: Adding different song with priority...');
    try {
      const priorityResponse = await axios.post('http://localhost:3002/api/queue/add', {
        bar_id: barId,
        song_id: 'spotify:track:0987654321',
        title: 'Test Song 2',
        artist: 'Test Artist 2',
        album: 'Test Album 2',
        duration_ms: 200000,
        album_cover: 'https://example.com/cover2.jpg',
        priority: true
      }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      console.log('✅ Priority song added successfully:', priorityResponse.data);
    } catch (error) {
      console.log('❌ Failed to add priority song:', error.response?.status, error.response?.data);
    }
    
    // Test 5: Check queue
    console.log('\n📋 Test 5: Checking queue...');
    try {
      const queueResponse = await axios.get(`http://localhost:3002/api/queue/${barId}`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      console.log('✅ Queue retrieved:', queueResponse.data);
    } catch (error) {
      console.log('❌ Failed to get queue:', error.response?.status, error.response?.data);
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testQueueFlow();