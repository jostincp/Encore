import { jest } from '@jest/globals';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { config } from '../src/config';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn()
  }));
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

// Mock logger - using generic mock
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

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

// Mock external services
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('salt')
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ id: 'user-id', email: 'test@example.com' }),
  decode: jest.fn().mockReturnValue({ id: 'user-id', email: 'test@example.com' })
}));

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test teardown
afterAll(async () => {
  // Clean up any resources
});

// Helper functions for tests
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  first_name: 'Test',
  last_name: 'User',
  role: 'user',
  is_verified: true,
  created_at: new Date(),
  updated_at: new Date()
};

export const mockBar = {
  id: 'test-bar-id',
  name: 'Test Bar',
  owner_id: 'test-owner-id',
  address: '123 Test St',
  city: 'Test City',
  state: 'TS',
  zip_code: '12345',
  phone: '555-0123',
  email: 'bar@test.com',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date()
};

export const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: mockUser,
  ...overrides
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

export const mockNext = jest.fn();

// Database test helpers
export const mockDbQuery = (result: any) => {
  mockPool.query.mockResolvedValueOnce({ rows: Array.isArray(result) ? result : [result] });
};

export const mockDbError = (error: Error) => {
  mockPool.query.mockRejectedValueOnce(error);
};

// Export mocks for external use
export { mockPool, mockLogger };

// Redis test helpers
export const mockRedisGet = (value: any) => {
  const Redis = require('ioredis');
  const mockRedis = new Redis();
  mockRedis.get.mockResolvedValueOnce(value);
  return mockRedis;
};

export const mockRedisSet = () => {
  const Redis = require('ioredis');
  const mockRedis = new Redis();
  mockRedis.set.mockResolvedValueOnce('OK');
  mockRedis.setex.mockResolvedValueOnce('OK');
  return mockRedis;
};

// JWT test helpers
export const mockJwtSign = (payload: any) => {
  const jwt = require('jsonwebtoken');
  jwt.sign.mockReturnValueOnce(`mock-token-${JSON.stringify(payload)}`);
  return jwt;
};

export const mockJwtVerify = (payload: any) => {
  const jwt = require('jsonwebtoken');
  jwt.verify.mockReturnValueOnce(payload);
  return jwt;
};

// Email test helpers
export const mockEmailSend = (result: any = { messageId: 'test-message-id' }) => {
  const nodemailer = require('nodemailer');
  const mockTransporter = nodemailer.createTransport();
  mockTransporter.sendMail.mockResolvedValueOnce(result);
  return mockTransporter;
};

// Error test helpers
export const expectError = (fn: Function, errorMessage?: string) => {
  return expect(fn).rejects.toThrow(errorMessage);
};

export const expectValidationError = (fn: Function) => {
  return expect(fn).rejects.toThrow('Validation failed');
};

export const expectAuthError = (fn: Function) => {
  return expect(fn).rejects.toThrow('Unauthorized');
};