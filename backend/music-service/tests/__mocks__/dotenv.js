// Mock para dotenv en las pruebas
module.exports = {
  config: jest.fn(() => ({
    parsed: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      JWT_SECRET: 'test-jwt-secret-key-with-minimum-32-characters',
      REDIS_URL: 'redis://localhost:6379',
      PORT: '3001',
      SERVICE_NAME: 'encore-music-service-test'
    }
  }))
};