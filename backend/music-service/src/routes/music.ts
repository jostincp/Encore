import { Router } from 'express';
import { query, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { MusicController } from '../controllers/musicController';

const router = Router();

// Validation schemas
const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),
  query('barId')
    // .isUUID() // Temporalmente deshabilitado para desarrollo
    .withMessage('barId is required'),
  query('maxResults')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('maxResults must be between 1 and 50'),
  query('order')
    .optional()
    .isIn(['relevance', 'date', 'rating', 'title', 'videoCount', 'viewCount'])
    .withMessage('Invalid order parameter'),
  query('safeSearch')
    .optional()
    .isIn(['moderate', 'none', 'strict'])
    .withMessage('safeSearch must be moderate, none, or strict')
];

const videoIdValidation = [
  param('videoId')
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage('Invalid YouTube video ID format')
];

const suggestionsValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Query must be between 1 and 200 characters')
];

// ==============================================
// MUSIC SEARCH ROUTES
// ==============================================

/**
 * @route GET /api/music/search
 * @desc Search for music on YouTube
 * @access Private
 */
router.get('/search',
  // authenticateToken, // Temporalmente deshabilitado para desarrollo
  searchValidation,
  handleValidationErrors,
  MusicController.searchMusic
);

/**
 * @route GET /api/music/videos/:videoId
 * @desc Get detailed information about a YouTube video
 * @access Private
 */
router.get('/videos/:videoId',
  authenticateToken,
  videoIdValidation,
  handleValidationErrors,
  MusicController.getVideoDetails
);

/**
 * @route GET /api/music/videos/:videoId/availability
 * @desc Check if a YouTube video is available
 * @access Private
 */
router.get('/videos/:videoId/availability',
  authenticateToken,
  videoIdValidation,
  handleValidationErrors,
  MusicController.checkVideoAvailability
);

/**
 * @route GET /api/music/suggestions
 * @desc Get search suggestions
 * @access Private
 */
router.get('/suggestions',
  authenticateToken,
  suggestionsValidation,
  handleValidationErrors,
  MusicController.getSearchSuggestions
);

// ==============================================
// ADMIN/MONITORING ROUTES
// ==============================================

/**
 * @route GET /api/music/stats
 * @desc Get YouTube API service statistics
 * @access Private (Admin)
 */
router.get('/stats',
  authenticateToken,
  MusicController.getApiStats
);

/**
 * @route POST /api/music/cache/clear
 * @desc Clear search cache
 * @access Private (Admin)
 */
router.post('/cache/clear',
  authenticateToken,
  query('query')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Query pattern must be less than 200 characters'),
  handleValidationErrors,
  MusicController.clearSearchCache
);

export default router;