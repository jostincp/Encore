import axios from 'axios';

// Configuration
const SERVICES = {
  AUTH: 'http://localhost:3001',
  MUSIC: 'http://localhost:3002',
  QUEUE: 'http://localhost:3003',
  ANALYTICS: 'http://localhost:3005',
  MENU: 'http://localhost:3006',
  POINTS: 'http://localhost:3007'
};

const TEST_USER = {
  email: `test_${Date.now()}@example.com`,
  password: 'Password123!',
  name: 'Test User'
};

async function runValidation() {
  console.log('🚀 Starting System Validation...');
  let token = '';
  let userId = '';

  // 1. Auth Service Validation
  console.log('\n🔐 Testing Auth Service...');
  try {
    // Register as Bar Owner to get a user with credentials and a Bar
    console.log('   Registering bar owner...');
    const registerRes = await axios.post(`${SERVICES.AUTH}/api/auth/register-bar-owner`, {
      email: TEST_USER.email,
      password: TEST_USER.password,
      firstName: 'Test',
      lastName: 'User',
      barName: 'Test Bar',
      address: '123 Test St',
      city: 'Test City',
      country: 'Test Country'
    });
    console.log('   ✅ Registration successful');
    
    // The register response usually returns token and user/bar info
    // Adjust based on actual response structure
    console.log('   DEBUG: Register response keys:', Object.keys(registerRes.data));
    if (registerRes.data.data) {
        console.log('   DEBUG: Register response data keys:', Object.keys(registerRes.data.data));
        if (registerRes.data.data.bar) console.log('   DEBUG: Bar object found');
        if (registerRes.data.data.token) console.log('   DEBUG: Token found');
    }

    if (registerRes.data.data && registerRes.data.data.accessToken) {
        token = registerRes.data.data.accessToken;
        userId = registerRes.data.data.user.id;
        const barId = registerRes.data.data.bar?.id || registerRes.data.data.user?.barId || 'default-bar-id';
        
        // Decode token to debug
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                console.log('   🕵️ Token Payload:', JSON.stringify(payload, null, 2));
            }
        } catch (e) {
            console.error('   ⚠️ Failed to decode token for debug');
        }

        console.log(`   🔑 Token obtained`);
        console.log(`   🍺 Bar ID obtained: ${barId}`);
        
        // Pass barId to other tests
        await runServiceTests(token, barId);
        return;
    }

    // Login if token not returned directly (though it usually is)
    console.log('   Logging in...');
    const loginRes = await axios.post(`${SERVICES.AUTH}/api/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    token = loginRes.data.data.token;
    userId = loginRes.data.data.user.id;
    const userBarId = loginRes.data.data.user.barId || 'default-bar-id'; // Assuming barId is on user or we default
    console.log(`   ✅ Login successful (BarID: ${userBarId})`);
    console.log(`   🔑 Token obtained`);
    
    await runServiceTests(token, userBarId);

  } catch (error: any) {
    console.error('   ❌ Auth Failed:', error.message);
    if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function runServiceTests(token: string, barId: string) {
  // 2. Menu Service Validation (Public?)
  console.log('\n🍔 Testing Menu Service...');
  try {
    // Get Categories
    const catRes = await axios.get(`${SERVICES.MENU}/api/bars/${barId}/categories`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Categories fetched: ${catRes.data.data.length} items`);

    // Get Items
    const menuRes = await axios.get(`${SERVICES.MENU}/api/bars/${barId}/menu`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Menu items fetched: ${menuRes.data.data.items.length} items`);
  } catch (error: any) {
    console.error('   ❌ Menu Service Failed:', error.response?.data || error.message);
  }

  // 3. Points Service Validation (Protected)
  console.log('\n💰 Testing Points Service...');
  try {
    const balanceRes = await axios.get(`${SERVICES.POINTS}/api/points/bars/${barId}/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Response structure: { success: true, data: { user_id, bar_id, balance } }
    console.log(`   ✅ Balance fetched: ${balanceRes.data.data?.balance ?? balanceRes.data.balance}`);

    const txRes = await axios.get(`${SERVICES.POINTS}/api/points/bars/${barId}/transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Response structure: { transactions: [], total: 0 ... } OR { success: true, data: { transactions: [] } }
    // Based on PointsController, it returns paginated result directly or wrapped? 
    // PointsController.getUserTransactions calls PointsModel.getUserTransactions which returns PaginatedPointsResult.
    // Controller sends res.json(result).
    // So likely { transactions: [], total: ... }
    const txCount = txRes.data.transactions ? txRes.data.transactions.length : (txRes.data.data?.transactions?.length ?? 0);
    console.log(`   ✅ Transactions fetched: ${txCount} records`);

  } catch (error: any) {
    console.error('   ❌ Points Service Failed:');
    if (error.response) {
      console.error(`      Status: ${error.response.status}`);
      console.error(`      Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`      Error: ${error.message}`);
    }
  }

  // 4. Analytics Service Validation (Protected)
  console.log('\n📊 Testing Analytics Service...');
  try {
    // Health check first
    try {
        await axios.get(`${SERVICES.ANALYTICS}/api/v1/health`);
        console.log('   ✅ Health check passed');
    } catch (e: any) {
        console.warn('   ⚠️ Health check failed:', e.message);
    }

    await axios.post(`${SERVICES.ANALYTICS}/api/v1/events`, {
      event_type: 'system',
      event_name: 'test_event',
      event_data: { foo: 'bar' },
      bar_id: barId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('   ✅ Event tracking successful');

  } catch (error: any) {
    console.error('   ❌ Analytics Service Failed:');
    if (error.code) console.error(`      Code: ${error.code}`);
    if (error.response) {
        console.error(`      Status: ${error.response.status}`);
        console.error(`      Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
        console.error(`      Error: ${error.message}`);
    }
  }

  console.log('\n✅ Validation Complete.');
}


runValidation();
