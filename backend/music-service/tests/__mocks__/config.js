// Mock para la configuración compartida en las pruebas
const mockConfig = {
  port: 3001,
  nodeEnv: 'test',
  serviceName: 'encore-music-service-test',
  database: {
    url: 'postgresql://test:test@localhost:5432/encore_test',
    ssl: false,
    pool: {
      min: 2,
      max: 10
    }
  },
  redis: {
    url: 'redis://localhost:6379',
    password: undefined,
    db: 0
  },
  jwt: {
    secret: 'test-jwt-secret-key-with-minimum-32-characters',
    expiresIn: '24h',
    refreshExpiresIn: '7d'
  },
  bcrypt: {
    rounds: 12
  },
  cors: {
    origins: ['http://localhost:3000'],
    credentials: false
  },
  rateLimit: {
    windowMs: 900000,
    maxRequests: 100,
    authWindowMs: 900000,
    authMaxRequests: 5
  },
  external: {
    youtube: {
      apiKey: 'test_youtube_api_key',
      quotaLimit: 10000
    },
    spotify: {
      clientId: 'test_spotify_client_id',
      clientSecret: 'test_spotify_client_secret',
      redirectUri: undefined
    },
    stripe: {
      publishableKey: undefined,
      secretKey: undefined,
      webhookSecret: undefined
    }
  },
  websocket: {
    corsOrigins: ['http://localhost:3000'],
    transports: ['websocket']
  },
  services: {
    auth: { port: 3000, url: 'http://localhost:3000' },
    music: { port: 3001, url: 'http://localhost:3001' },
    queue: { port: 3002, url: 'http://localhost:3002' },
    points: { port: 3003, url: 'http://localhost:3003' },
    analytics: { port: 3004, url: 'http://localhost:3004' },
    menu: { port: 3005, url: 'http://localhost:3005' }
  },
  logging: {
    level: 'info',
    filePath: undefined,
    maxSize: undefined,
    maxFiles: undefined
  },
  development: {
    enableApiDocs: true,
    apiDocsPath: '/api-docs'
  },
  monitoring: {
    sentryDsn: undefined
  }
};

module.exports = {
  getConfig: () => mockConfig,
  config: mockConfig,
  validateServiceConfig: jest.fn(),
  getServiceConfig: () => mockConfig,
  getEnvironmentDefaults: () => ({}),
  isProduction: () => false,
  isDevelopment: () => false,
  isTesting: () => true
};