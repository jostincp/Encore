const axios = require('axios');

// Datos de prueba
const ADMIN_EMAIL = 'admin@encore.com';
const ADMIN_PASSWORD = 'Password123!';
const TEST_USER_EMAIL = 'test@encore.com';
const TEST_USER_PASSWORD = 'password123';

async function setupTestEnvironment() {
  try {
    console.log('🎯 Setting up test environment...\n');
    
    // 1. Login as admin
    console.log('🔐 1. Logging in as admin...');
    const adminLogin = await axios.post('http://localhost:3001/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    const adminToken = adminLogin.data.token;
    console.log('✅ Admin logged in successfully');
    
    // 2. Get or create a bar
    console.log('\n🏪 2. Getting or creating a bar...');
    let barId;
    
    try {
      const barsResponse = await axios.get('http://localhost:3001/api/bars', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (barsResponse.data.bars && barsResponse.data.bars.length > 0) {
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
    } catch (error) {
      console.log('⚠️  Could not get bars, using test bar ID');
      barId = 'test-bar-123';
    }
    
    // 3. Create test user
    console.log('\n👤 3. Creating test user...');
    let userId;
    let userToken;
    
    try {
      // Try to register user
      const userResponse = await axios.post('http://localhost:3001/api/auth/register-user', {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        first_name: 'Test',
        last_name: 'User',
        phone: '+1234567890'
      });
      
      userId = userResponse.data.user.id;
      userToken = userResponse.data.token;
      console.log('✅ Test user created:', userId);
    } catch (error) {
      if (error.response?.data?.error?.includes('already exists')) {
        console.log('🔄 User already exists, logging in...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD
        });
        
        userId = loginResponse.data.user.id;
        userToken = loginResponse.data.token;
        console.log('✅ User logged in:', userId);
      } else {
        throw error;
      }
    }
    
    // 4. Add points to user
    console.log('\n💰 4. Adding points to user...');
    try {
      await axios.post('http://localhost:3002/api/points/add', {
        user_id: userId,
        points: 500,
        reason: 'Test setup'
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ Added 500 points to user');
    } catch (error) {
      console.log('⚠️  Could not add points:', error.response?.data?.error || error.message);
    }
    
    // 5. Test queue functionality
    console.log('\n🎵 5. Testing queue functionality...');
    
    // Test 1: Add song with insufficient points (simulate)
    console.log('\n🧪 Test 1: Testing insufficient points...');
    try {
      // First remove points to simulate insufficient balance
      await axios.post('http://localhost:3002/api/points/deduct', {
        user_id: userId,
        points: 500,
        reason: 'Remove all points for test'
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      try {
        await axios.post('http://localhost:3002/api/queue/add', {
          bar_id: barId,
          song_id: 'spotify:track:insufficient',
          title: 'Test Song 1',
          artist: 'Test Artist',
          album: 'Test Album',
          duration_ms: 180000,
          album_cover: 'https://example.com/cover.jpg',
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
      
      // Restore points
      await axios.post('http://localhost:3002/api/points/add', {
        user_id: userId,
        points: 500,
        reason: 'Restore points'
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
    } catch (error) {
      console.log('⚠️  Could not test insufficient points:', error.response?.data?.error || error.message);
    }
    
    // Test 2: Add song successfully
    console.log('\n🧪 Test 2: Adding song successfully...');
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
      console.log('✅ Song added successfully');
    } catch (error) {
      console.log('❌ Failed to add song:', error.response?.status, error.response?.data);
    }
    
    // Test 3: Add same song again (should fail with 409)
    console.log('\n🧪 Test 3: Adding same song again (should fail with 409)...');
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
    
    // Test 4: Add priority song
    console.log('\n🧪 Test 4: Adding priority song...');
    try {
      const priorityResponse = await axios.post('http://localhost:3002/api/queue/add', {
        bar_id: barId,
        song_id: 'spotify:track:priority123',
        title: 'Priority Song',
        artist: 'Priority Artist',
        album: 'Priority Album',
        duration_ms: 200000,
        album_cover: 'https://example.com/priority.jpg',
        priority: true
      }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      console.log('✅ Priority song added successfully');
    } catch (error) {
      console.log('❌ Failed to add priority song:', error.response?.status, error.response?.data);
    }
    
    console.log('\n🎉 Test environment setup completed!');
    console.log('📋 Summary:');
    console.log('  - Bar ID:', barId);
    console.log('  - User ID:', userId);
    console.log('  - User Token:', userToken.substring(0, 20) + '...');
    console.log('  - Admin Token:', adminToken.substring(0, 20) + '...');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

setupTestEnvironment();