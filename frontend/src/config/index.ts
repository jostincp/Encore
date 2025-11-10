export const config = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  YOUTUBE_API_KEY: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || '',
  ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
  
  // Feature flags
  features: {
    youtubePlayer: true,
    playlists: true,
    queue: true,
  },
  
  // API endpoints
  endpoints: {
    youtube: {
      search: '/youtube/search',
      playlists: '/youtube/playlists',
      queue: '/queue',
    },
  },
  
  // Validation
  isValid: () => {
    return !!config.API_URL;
  },
  
  // Warnings
  validate: () => {
    if (!config.API_URL) {
      console.warn('⚠️ NEXT_PUBLIC_API_URL is not configured');
    }
    if (!config.YOUTUBE_API_KEY) {
      console.warn('⚠️ NEXT_PUBLIC_YOUTUBE_API_KEY is not configured');
    }
  },
};

// Validate on load
if (typeof window !== 'undefined') {
  config.validate();
}