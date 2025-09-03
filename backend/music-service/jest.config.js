// Configurar variables de entorno antes de que Jest inicie
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

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
    '^dotenv$': '<rootDir>/tests/__mocks__/dotenv.js',
    '^@shared/config$': '<rootDir>/tests/__mocks__/config.js',
    '^@shared/database$': '<rootDir>/tests/__mocks__/database.js'
  },
  testTimeout: 10000,
  verbose: true
};