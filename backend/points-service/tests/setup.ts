import { jest } from '@jest/globals';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  flushall: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn()
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// Mock database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
};

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => mockPool)
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock Logger - using generic mock since utils doesn't exist yet
jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('salt')
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mockToken'),
  verify: jest.fn().mockReturnValue({ userId: 'user-123', role: 'user' }),
  decode: jest.fn().mockReturnValue({ userId: 'user-123', role: 'user' })
}));

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/encore_test';
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset Redis mock responses
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue('OK');
  mockRedis.del.mockResolvedValue(1);
  mockRedis.exists.mockResolvedValue(0);
  mockRedis.expire.mockResolvedValue(1);
});

afterAll(async () => {
  // Cleanup after all tests
  await mockPool.end();
  await mockRedis.quit();
});

// Helper functions for tests
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  role: 'user',
  is_verified: true,
  created_at: new Date(),
  updated_at: new Date()
};

export const mockAdmin = {
  id: 'admin-123',
  email: 'admin@example.com',
  username: 'admin',
  role: 'admin',
  is_verified: true,
  created_at: new Date(),
  updated_at: new Date()
};

export const mockBarOwner = {
  id: 'owner-123',
  email: 'owner@example.com',
  username: 'barowner',
  role: 'bar_owner',
  is_verified: true,
  created_at: new Date(),
  updated_at: new Date()
};

export const mockBar = {
  id: 'bar-123',
  name: 'Test Bar',
  address: '123 Test St',
  city: 'Test City',
  owner_id: 'owner-123',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
};

export const mockTransaction = {
  id: 'txn-123',
  user_id: 'user-123',
  bar_id: 'bar-123',
  points: 50,
  type: 'earned',
  reason: 'Test transaction',
  created_by: 'admin-123',
  created_at: new Date()
};

export const mockPointsBalance = {
  user_id: 'user-123',
  bar_id: 'bar-123',
  balance: 100,
  total_earned: 200,
  total_spent: 100,
  last_transaction_at: new Date()
};

// Mock request object
export const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: mockUser,
  ...overrides
});

// Mock response object
export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

// Mock next function
export const mockNext = jest.fn();

// Database helper functions
export const mockDbQuery = (result: any) => {
  mockPool.query.mockResolvedValueOnce({ rows: Array.isArray(result) ? result : [result] });
};

export const mockDbError = (error: Error) => {
  mockPool.query.mockRejectedValueOnce(error);
};

// Redis helper functions
export const mockRedisGet = (key: string, value: any) => {
  mockRedis.get.mockImplementation((k: string) => {
    if (k === key) {
      return Promise.resolve(typeof value === 'string' ? value : JSON.stringify(value));
    }
    return Promise.resolve(null);
  });
};

export const mockRedisSet = (key: string, value: any) => {
  mockRedis.set.mockImplementation((k: string, v: any) => {
    if (k === key) {
      return Promise.resolve('OK');
    }
    return Promise.resolve('OK');
  });
};

// Error expectation helper
export const expectError = (error: any, message: string, statusCode?: number) => {
  expect(error.message).toContain(message);
  if (statusCode) {
    expect(error.statusCode).toBe(statusCode);
  }
};

// Test database setup and cleanup
export const setupTestDb = async () => {
  // Mock database setup
  mockPool.query.mockResolvedValue({ rows: [] });
};

export const cleanupTestDb = async () => {
  // Mock database cleanup
  mockPool.query.mockResolvedValue({ rows: [] });
};

// Create test entities
export const createTestUser = async (overrides = {}) => {
  const user = { ...mockUser, ...overrides };
  mockDbQuery(user);
  return user;
};

export const createTestBar = async (overrides = {}) => {
  const bar = { ...mockBar, ...overrides };
  mockDbQuery(bar);
  return bar;
};

export const createTestTransaction = async (overrides = {}) => {
  const transaction = { ...mockTransaction, ...overrides };
  mockDbQuery(transaction);
  return transaction;
};

export const createTestPointsBalance = async (overrides = {}) => {
  const balance = { ...mockPointsBalance, ...overrides };
  mockDbQuery(balance);
  return balance;
};

// Export mocked modules for direct access in tests
export { mockRe