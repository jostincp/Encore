// QR Service Test with Valid Token
const jwt = require('jsonwebtoken');
const http = require('http');

const API_BASE_URL = 'http://localhost:3007';
const JWT_SECRET = 'your-super-secret-jwt-key';

// Generate a valid JWT token for testing
function generateTestToken() {
  return jwt.sign(
    { 
      userId: 'test-user-123',
      email: 'test@encore.com',
      role: 'bar_owner'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      ...options
    };

    const request = http.request(url, requestOptions, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: response.statusCode,
            data: jsonData
          });
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      request.write(JSON.stringify(options.body));
    }

    request.end();
  });
}

async function testWithValidToken() {
  console.log('🔐 Testing QR Service with Valid JWT Token\n');
  
  const validToken = generateTestToken();
  console.log(`📝 Generated test token: ${validToken.substring(0, 50)}...`);
  
  try {
    // Test bar data
    console.log('🏠 Testing bar data with valid token...');
    const barResponse = await makeRequest(`${API_BASE_URL}/api/bars/my`, {
      headers: {
        'Authorization': `Bearer ${validToken}`
      }
    });
    
    if (barResponse.statusCode === 200 && barResponse.data.success) {
      console.log('✅ Bar data retrieved successfully');
      console.log(`   - Bar ID: ${barResponse.data.data.id}`);
      console.log(`   - Bar Name: ${barResponse.data.data.name}`);
      console.log(`   - Total Tables: ${barResponse.data.data.totalTables}`);
      
      // Test QR generation
      console.log('\n🔳 Testing QR code generation...');
      const qrResponse = await makeRequest(`${API_BASE_URL}/api/bars/my/qrcodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${validToken}`
        },
        body: {
          tableNumber: 5,
          regenerate: true
        }
      });
      
      if (qrResponse.statusCode === 200 && qrResponse.data.success) {
        console.log('✅ QR code generated successfully');
        console.log(`   - QR ID: ${qrResponse.data.data.id}`);
        console.log(`   - Table: ${qrResponse.data.data.tableNumber}`);
        console.log(`   - QR URL: ${qrResponse.data.data.qrUrl}`);
        console.log(`   - Active: ${qrResponse.data.data.isActive}`);
        
        // Test QR list
        console.log('\n📋 Testing QR code list...');
        const listResponse = await makeRequest(`${API_BASE_URL}/api/bars/my/qrcodes`, {
          headers: {
            'Authorization': `Bearer ${validToken}`
          }
        });
        
        if (listResponse.statusCode === 200 && listResponse.data.success) {
          console.log('✅ QR code list retrieved successfully');
          console.log(`   - Total QRs: ${listResponse.data.count}`);
          
          if (listResponse.data.data.length > 0) {
            const firstQR = listResponse.data.data[0];
            console.log(`   - Sample: Table ${firstQR.tableNumber}, Scans: ${firstQR.scannedCount || 0}`);
          }
          
          console.log('\n🎉 All authenticated tests passed!');
          console.log('🚀 QR Service is fully functional with JWT authentication');
          
        } else {
          console.log('❌ QR list test failed');
        }
        
      } else {
        console.log('❌ QR generation test failed');
        console.log(`   - Status: ${qrResponse.statusCode}`);
        console.log(`   - Error: ${qrResponse.data.message}`);
      }
      
    } else {
      console.log('❌ Bar data test failed');
      console.log(`   - Status: ${barResponse.statusCode}`);
      console.log(`   - Error: ${barResponse.data.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testWithValidToken().catch(console.error);
}

module.exports = { testWithValidToken };
