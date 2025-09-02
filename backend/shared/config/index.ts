import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export interface Config {
  // Configuración del servidor
  port: number;
  nodeEnv: string;
  serviceName: string;
  
  // Base de datos
  databaseUrl: string;
  
  // Redis
  redisUrl: string;
  
  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  
  // CORS
  corsOrigins: string[];
  
  // APIs externas
  youtubeApiKey?: string;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  
  // Stripe
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  
  // Logging
  logLevel: string;
  
  // Rate limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

const getConfig = (): Config => {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'REDIS_URL'
  ];

  // Verificar variables de entorno requeridas
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    // Servidor
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceName: process.env.SERVICE_NAME || 'encore-service',
    
    // Base de datos
    databaseUrl: process.env.DATABASE_URL!,
    
    // Redis
    redisUrl: process.env.REDIS_URL!,
    
    // JWT
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    
    // CORS
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
    
    // APIs externas
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    
    // Stripe
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Rate limiting
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  };
};

export const config = getConfig();

// Validar configuración específica por servicio
export const validateServiceConfig = (serviceName: string): void => {
  switch (serviceName) {
    case 'music-service':
      if (!config.youtubeApiKey && !config.spotifyClientId) {
        throw new Error('Music service requires either YOUTUBE_API_KEY or SPOTIFY_CLIENT_ID');
      }
      break;
      
    case 'points-service':
      if (!config.stripeSecretKey) {
        console.warn('Points service: STRIPE_SECRET_KEY not configured, payment features will be disabled');
      }
      break;
      
    default:
      // No validación específica requerida
      break;
  }
};

// Función para obtener configuración específica del servicio
export const getServiceConfig = (serviceName: string): Config => {
  validateServiceConfig(serviceName);
  return { ...config, serviceName };
};

// Configuraciones por defecto para diferentes entornos
export const getEnvironmentDefaults = () => {
  const defaults = {
    development: {
      logLevel: 'debug',
      corsOrigins: ['http://localhost:3000', 'http://localhost:3001'],
      rateLimitMaxRequests: 1000
    },
    production: {
      logLevel: 'info',
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
      rateLimitMaxRequests: 100
    },
    test: {
      logLevel: 'error',
      corsOrigins: ['http://localhost:3000'],
      rateLimitMaxRequests: 1000
    }
  };

  return defaults[config.nodeEnv as keyof typeof defaults] || defaults.development;
};

// Función para verificar si estamos en producción
export const isProduction = (): boolean => {
  return config.nodeEnv === 'production';
};

// Función para verificar si estamos en desarrollo
export const isDevelopment = (): boolean => {
  return config.nodeEnv === 'development';
};

// Función para verificar si estamos en testing
export const isTesting = (): boolean => {
  return config.nodeEnv === 'test';
};