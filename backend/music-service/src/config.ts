import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, '../../../.env') });

interface MusicServiceConfig {
    server: {
        port: number;
        env: string;
    };
    youtube: {
        apiKey: string | undefined;
    };
    database: {
        url: string;
    };
    redis: {
        url: string;
    };
}

const config: MusicServiceConfig = {
    server: {
        port: parseInt(process.env.MUSIC_SERVICE_PORT || process.env.PORT || '3002', 10),
        env: process.env.NODE_ENV || 'development'
    },
    youtube: {
        apiKey: process.env.YOUTUBE_API_KEY
    },
    database: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/encore_db'
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    }
};

export default config;
