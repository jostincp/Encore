import { Router } from 'express';
import { query, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import YouTubeController from '../controllers/youtubeController';

// Validation schemas
const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),
  query('maxResults')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('maxResults must be between 1 and 50'),
  query('order')
    .optional()
    .isIn(['relevance', 'date', 'rating', 'title', 'videoCount', 'viewCount'])
    .withMessage('Invalid order parameter'),
  query('regionCode')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('regionCode must be a 2-letter country code')
];

const videoIdValidation = [
  param('videoId')
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage('Invalid YouTube video ID format')
];

const channelIdValidation = [
  param('channelId')
    .matches(/^[a-zA-Z0-9_-]{24}$/)
    .withMessage('Invalid YouTube channel ID format')
];

const trendingValidation = [
  query('regionCode')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('regionCode must be a 2-letter country code'),
  query('maxResults')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('maxResults must be between 1 and 50')
];

const channelVideosValidation = [
  query('maxResults')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('maxResults must be between 1 and 50')
];

const router = Router();

// ==============================================
// YOUTUBE API ROUTES
// ==============================================

// Buscar videos en YouTube
router.get('/search',
  authenticateToken,
  searchValidation,
  handleValidationErrors,
  YouTubeController.searchVideos
);

// Obtener detalles de un video
router.get('/videos/:videoId',
  authenticateToken,
  videoIdValidation,
  handleValidationErrors,
  YouTubeController.getVideoDetails
);

// Obtener videos trending de música
router.get('/trending/music',
  authenticateToken,
  trendingValidation,
  handleValidationErrors,
  YouTubeController.getTrendingVideos
);

// Obtener videos de un canal específico
router.get('/channels/:channelId/videos',
  authenticateToken,
  channelIdValidation,
  channelVideosValidation,
  handleValidationErrors,
  YouTubeController.getChannelVideos
);

// ==============================================
// ADMIN/MONITORING ROUTES
// ==============================================

// Obtener estadísticas del servicio
router.get('/stats',
  authenticateToken,
  YouTubeController.getServiceStats
);

// Invalidar caché (solo admin)
router.post('/cache/invalidate',
  authenticateToken,
  query('pattern')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Pattern must be less than 100 characters'),
  handleValidationErrors,
  YouTubeController.invalidateCache
);

export default router;