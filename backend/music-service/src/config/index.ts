import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['YOUTUBE_API_KEY'];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// YouTube API Configuration
export const youtubeConfig = {
  apiKey: process.env.YOUTUBE_API_KEY!,
  baseUrl: process.env.YOUTUBE_API_BASE_URL || 'https://www.googleapis.com/youtube/v3',
  maxResults: parseInt(process.env.YOUTUBE_MAX_RESULTS || '20'),
  regionCode: process.env.YOUTUBE_REGION_CODE || 'US',
  cacheTTL: parseInt(process.env.YOUTUBE_CACHE_TTL || '172800'), // 48 hours
  searchCacheTTL: parseInt(process.env.YOUTUBE_SEARCH_CACHE_TTL || '172800'),
  trendingCacheTTL: parseInt(process.env.YOUTUBE_TRENDING_CACHE_TTL || '172800'),
  videoCategoryId: '10' // Music category
};

// Spotify API Configuration (for future use)
export const spotifyConfig = {
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  baseUrl: process.env.SPOTIFY_API_BASE_URL || 'https://api.spotify.com/v1',
  tokenUrl: process.env.SPOTIFY_TOKEN_URL || 'https://accounts.spotify.com/api/token',
  market: process.env.SPOTIFY_MARKET || 'US',
  cacheTTL: parseInt(process.env.SPOTIFY_CACHE_TTL || '3600'),
  searchCacheTTL: parseInt(process.env.SPOTIFY_SEARCH_CACHE_TTL || '1800'),
  tokenCacheTTL: parseInt(process.env.SPOTIFY_TOKEN_CACHE_TTL || '3000')
};

// External Service URLs
export const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  queue: process.env.QUEUE_SERVICE_URL || 'http://localhost:3003',
  points: process.env.POINTS_SERVICE_URL || 'http://localhost:3006',
  menu: process.env.MENU_SERVICE_URL || 'http://localhost:3005',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007'
};

// Logging Configuration
export const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  fileEnabled: process.env.LOG_FILE_ENABLED === 'true',
  filePath: process.env.LOG_FILE_PATH || 'logs/music-service.log',
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
};

// Server Configuration
export const serverConfig = {
  port: parseInt(process.env.PORT || process.env.MUSIC_PORT || '3002'),
  env: process.env.NODE_ENV || 'development'
};

export default {
  youtube: youtubeConfig,
  spotify: spotifyConfig,
  services,
  logging: logConfig,
  server: serverConfig
};
