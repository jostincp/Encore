import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde el directorio raíz
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface Config {
  // Configuración del servidor
  port: number;
  nodeEnv: string;
  serviceName: string;
  
  // Base de datos
  database: {
    url: string;
    ssl: boolean;
    pool: {
      min: number;
      max: number;
    };
  };
  
  // Redis
  redis: {
    url: string;
    password?: string;
    db: number;
  };
  
  // JWT y Seguridad
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  
  // Encriptación
  bcrypt: {
    rounds: number;
  };
  
  // CORS
  cors: {
    origins: string[];
    credentials: boolean;
  };
  
  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    authWindowMs: number;
    authMaxRequests: number;
  };
  
  // APIs externas
  external: {
    youtube: {
      apiKey?: string;
      quotaLimit: number;
    };
    spotify: {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
    };
    stripe: {
      publishableKey?: string;
      secretKey?: string;
      webhookSecret?: string;
    };
  };
  
  // WebSockets
  websocket: {
    corsOrigins: string[];
    transports: string[];
  };
  
  // Microservicios
  services: {
    auth: { port: number; url: string; };
    music: { port: number; url: string; };
    queue: { port: number; url: string; };
    points: { port: number; url: string; };
    analytics: { port: number; url: string; };
    menu: { port: number; url: string; };
  };
  
  // Logging y Monitoreo
  logging: {
    level: string;
    filePath?: string;
    maxSize?: string;
    maxFiles?: number;
  };
  
  // Desarrollo y Testing
  development: {
    enableApiDocs: boolean;
    apiDocsPath: string;
  };
  
  // Monitoreo
  monitoring: {
    sentryDsn?: string;
  };
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
      throw new Error(`Variable de entorno requerida faltante: ${envVar}`);
    }
  }

  // Validar JWT secret mínimo de seguridad
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres para seguridad');
  }

  return {
    // Servidor
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceName: process.env.SERVICE_NAME || 'encore-service',
    
    // Base de datos
    database: {
      url: process.env.DATABASE_URL!,
      ssl: process.env.DATABASE_SSL === 'true',
      pool: {
        min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
        max: parseInt(process.env.DATABASE_POOL_MAX || '10')
      }
    },
    
    // Redis
    redis: {
      url: process.env.REDIS_URL!,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    
    // JWT y Seguridad
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    
    // Encriptación
    bcrypt: {
      rounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
    },
    
    // CORS
    cors: {
      origins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : ['http://localhost:3000'],
      credentials: process.env.CORS_CREDENTIALS === 'true'
    },
    
    // Rate Limiting
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      authWindowMs: 15 * 60 * 1000, // 15 minutos para auth
      authMaxRequests: 5 // 5 intentos de auth por IP
    },
    
    // APIs externas
    external: {
      youtube: {
        apiKey: process.env.YOUTUBE_API_KEY,
        quotaLimit: parseInt(process.env.YOUTUBE_API_QUOTA_LIMIT || '10000')
      },
      spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        redirectUri: process.env.SPOTIFY_REDIRECT_URI
      },
      stripe: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
      }
    },
    
    // WebSockets
    websocket: {
      corsOrigins: process.env.SOCKET_IO_CORS_ORIGIN ? 
        process.env.SOCKET_IO_CORS_ORIGIN.split(',').map(o => o.trim()) : 
        ['http://localhost:3000'],
      transports: process.env.SOCKET_IO_TRANSPORTS ? 
        process.env.SOCKET_IO_TRANSPORTS.split(',').map(t => t.trim()) : 
        ['websocket', 'polling']
    },
    
    // Microservicios
    services: {
      auth: {
        port: parseInt(process.env.AUTH_SERVICE_PORT || '3001'),
        url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001'
      },
      music: {
        port: parseInt(process.env.MUSIC_SERVICE_PORT || '3002'),
        url: process.env.MUSIC_SERVICE_URL || 'http://localhost:3002'
      },
      queue: {
        port: parseInt(process.env.QUEUE_SERVICE_PORT || '3003'),
        url: process.env.QUEUE_SERVICE_URL || 'http://localhost:3003'
      },
      points: {
        port: parseInt(process.env.POINTS_SERVICE_PORT || '3004'),
        url: process.env.POINTS_SERVICE_URL || 'http://localhost:3004'
      },
      analytics: {
        port: parseInt(process.env.ANALYTICS_SERVICE_PORT || '3005'),
        url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3005'
      },
      menu: {
        port: parseInt(process.env.MENU_SERVICE_PORT || '3006'),
        url: process.env.MENU_SERVICE_URL || 'http://localhost:3006'
      }
    },
    
    // Logging y Monitoreo
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      filePath: process.env.LOG_FILE_PATH,
      maxSize: process.env.LOG_MAX_SIZE,
      maxFiles: process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES) : undefined
    },
    
    // Desarrollo y Testing
    development: {
      enableApiDocs: process.env.ENABLE_API_DOCS === 'true',
      apiDocsPath: process.env.API_DOCS_PATH || '/api/docs'
    },
    
    // Monitoreo
    monitoring: {
      sentryDsn: process.env.SENTRY_DSN
    }
  };
};

export const config = getConfig();

// Validar configuración específica por servicio
export const validateServiceConfig = (serviceName: string): void => {
  switch (serviceName) {
    case 'music-service':
      if (!config.external.youtube.apiKey && !config.external.spotify.clientId) {
        throw new Error('Music service requires either YOUTUBE_API_KEY or SPOTIFY_CLIENT_ID');
      }
      break;
      
    case 'points-service':
      if (!config.external.stripe.secretKey) {
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