import { jest } from '@jest/globals';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  flushall: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined)
};

// Mock Redis - using generic mock since config doesn't exist yet
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedis)
}));

// Mock Database Pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn()
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool)
}));

// Mock Logger
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
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({})),
    printf: jest.fn(() => ({}))
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock shared logger utilities
jest.mock('@shared/utils/logger', () => ({
  default: mockLogger,
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
  requestLogger: jest.fn((req: any, res: any, next: any) => next())
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('salt')
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock_token'),
  verify: jest.fn().mockReturnValue({ userId: 'user-123', role: 'user' }),
  decode: jest.fn().mockReturnValue({ userId: 'user-123', role: 'user' })
}));

// Mock Spotify Web API - using generic mock
const mockSpotifyApi = {
  authenticate: jest.fn().mockResolvedValue(undefined),
  search: jest.fn().mockResolvedValue({
    tracks: {
      items: []
    }
  }),
  tracks: {
    get: jest.fn().mockResolvedValue({
      id: 'track-123',
      name: 'Test Track',
      artists: [{ name: 'Test Artist' }]
    })
  }
};

// Mock YouTube API - using generic mock
const mockYouTubeApi = {
  search: {
    list: jest.fn().mockResolvedValue({
      data: {
        items: []
      }
    })
  },
  videos: {
    list: jest.fn().mockResolvedValue({
      data: {
        items: []
      }
    })
  }
};

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-with-minimum-32-characters';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/encore_test';
  process.env.SPOTIFY_CLIENT_ID = 'test_spotify_client_id';
  process.env.SPOTIFY_CLIENT_SECRET = 'test_spotify_client_secret';
  process.env.YOUTUBE_API_KEY = 'test_youtube_api_key';
  process.env.PORT = '3001';
  process.env.SERVICE_NAME = 'encore-music-service-test';
  process.env.CORS_ORIGIN = 'http://localhost:3000';
  process.env.RATE_LIMIT_WINDOW_MS = '900000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '100';
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
  
  // Reset Database mock responses
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
});

afterAll(async () => {
  // Clean up resources
  await mockRedis.quit();
  await mockPool.end();
});

// Helper functions for tests
export const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: { id: 'user-123', role: 'user' },
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

// Database helper functions
export const mockDbQuery = (mockResult: any) => {
  mockPool.query.mockResolvedValueOnce({
    rows: Array.isArray(mockResult) ? mockResult : [mockResult],
    rowCount: Array.isArray(mockResult) ? mockResult.length : 1
  });
};

export const mockDbError = (error: Error) => {
  mockPool.query.mockRejectedValueOnce(error);
};

// Redis helper functions
export const mockRedisGet = (key: string, value: any) => {
  mockRedis.get.mockImplementation((k: string) => {
    if (k === key) {
      return Promise.resolve(JSON.stringify(value));
    }
    return Promise.resolve(null);
  });
};

export const mockRedisSet = mockRedis.set;
export const mockRedisDel = mockRedis.del;

// Error expectation helper
export const expectError = (statusCode: number, message: string) => 
  expect.objectContaining({
    statusCode,
    message: expect.stringContaining(message)
  });

// Test data factories
export const createTestUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  role: 'user',
  is_verified: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

export const createTestBar = (overrides = {}) => ({
  id: 'bar-123',
  name: 'Test Bar',
  address: '123 Test St',
  city: 'Test City',
  state: 'TS',
  zip_code: '12345',
  phone: '555-0123',
  email: 'bar@test.com',
  owner_id: 'user-123',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

export const createTestSong = (overrides = {}) => ({
  id: 'spotify:track:123',
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  duration: 180,
  source: 'spotify',
  external_url: 'https://spotify.com/track/123',
  preview_url: 'https://spotify.com/preview/123',
  genres: ['pop', 'rock'],
  energy: 0.7,
  danceability: 0.6,
  valence: 0.8,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

export const createTestQueueEntry = (overrides = {}) => ({
  id: 'queue-123',
  bar_id: 'bar-123',
  user_id: 'user-123',
  song_id: 'spotify:track:123',
  song_title: 'Test Song',
  song_artist: 'Test Artist',
  song_duration: 180,
  source: 'spotify',
  position: 1,
  status: 'pending',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

export const createTestSpotifyTrack = (overrides = {}) => ({
  id: '123',
  name: 'Test Spotify Song',
  artists: [{ name: 'Test Spotify Artist' }],
  album: {
    name: 'Test Spotify Album',
    images: [{ url: 'https://spotify.com/image.jpg' }]
  },
  duration_ms: 180000,
  preview_url: 'https://spotify.com/preview/123',
  external_urls: {
    spotify: 'https://spotify.com/track/123'
  },
  ...overrides
});

export const createTestYouTubeVideo = (overrides = {}) => ({
  id: {
    videoId: 'abc123'
  },
  snippet: {
    title: 'Test YouTube Song',
    channelTitle: 'Test YouTube Artist',
    description: 'Test YouTube Description',
    thumbnails: {
      default: { url: 'https://youtube.com/thumb.jpg' }
    }
  },
  contentDetails: {
    duration: 'PT3M0S' // 3 minutes
  },
  ...overrides
});

// Export mocks for use in tests
export { mockRedis, mockPool, mockLogger, mockSpotifyApi, mockYouTubeApi };