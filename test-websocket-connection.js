#!/usr/bin/env node

/**
 * Test script for WebSocket connectivity to Queue Service
 */

const { io } = require('socket.io-client');

console.log('🔍 Testing Encore WebSocket Connection...\n');

// Configuration
const WS_URL = 'http://localhost:3003';
const TEST_BAR_ID = 'default-bar';

// Test connection
async function testWebSocketConnection() {
  try {
    console.log(`📡 Connecting to WebSocket server at ${WS_URL}...`);
    
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });

    // Connection events
    socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully!');
      console.log(`🆔 Socket ID: ${socket.id}`);
      
      // Test joining bar
      console.log(`\n🏠 Attempting to join bar: ${TEST_BAR_ID}`);
      socket.emit('join_bar', TEST_BAR_ID);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection failed:', error.message);
      process.exit(1);
    });

    // Bar events
    socket.on('bar_joined', (data) => {
      console.log('✅ Successfully joined bar:', data);
      
      // Test getting queue position
      console.log('\n📍 Testing queue position request...');
      socket.emit('get_queue_position', { barId: TEST_BAR_ID });
    });

    socket.on('queue_state', (data) => {
      console.log('✅ Queue state received:', {
        queueLength: data.queue?.length || 0,
        currentlyPlaying: data.currentlyPlaying?.title || 'None',
        totalCount: data.totalCount || 0
      });
    });

    socket.on('queue_position', (data) => {
      console.log('✅ Queue position received:', data);
      
      // Test ping
      console.log('\n🏓 Testing ping/pong...');
      socket.emit('ping');
    });

    socket.on('pong', (data) => {
      console.log('✅ Ping/pong successful:', data);
      
      // Test disconnect
      console.log('\n👋 Testing disconnect...');
      socket.emit('leave_bar', TEST_BAR_ID);
      setTimeout(() => {
        socket.disconnect();
        console.log('✅ Test completed successfully!');
        process.exit(0);
      }, 1000);
    });

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      process.exit(1);
    });

    // Timeout
    setTimeout(() => {
      console.error('❌ Test timed out after 10 seconds');
      socket.disconnect();
      process.exit(1);
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Health check test
async function testHealthCheck() {
  try {
    console.log(`🏥 Testing health check at ${WS_URL}/health...`);
    
    const response = await fetch(`${WS_URL}/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Health check successful:', {
      service: data.service,
      status: data.status,
      websocket: data.websocket
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting WebSocket connectivity tests...\n');
  
  // Test 1: Health check
  const healthCheckPassed = await testHealthCheck();
  
  if (!healthCheckPassed) {
    console.error('\n❌ Health check failed. Queue Service may not be running.');
    console.log('💡 Make sure Queue Service is started with: npm run dev:queue');
    process.exit(1);
  }
  
  // Test 2: WebSocket connection
  await testWebSocketConnection();
}

// Run tests
runTests().catch(console.error);
