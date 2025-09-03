import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';

// Mock controller and rate limiting
const SongController = {
  createSong: (req: any, res: any) => res.json({ success: true, message: 'Song created' }),
  getSongs: (req: any, res: any) => res.json({ success: true, data: [] }),
  getSongById: (req: any, res: any) => res.json({ success: true, data: null }),
  updateSong: (req: any, res: any) => res.json({ success: true, message: 'Song updated' }),
  deleteSong: (req: any, res: any) => res.json({ success: true, message: 'Song deleted' }),
  searchSongs: (req: any, res: any) => res.json({ success: true, data: [] }),
  getPopularSongs: (req: any, res: any) => res.json({ success: true, data: [] }),
  getRecentSongs: (req: any, res: any) => res.json({ success: true, data: [] }),
  searchYouTube: (req: any, res: any) => res.json({ success: true, data: [] }),
  searchSpotify: (req: any, res: any) => res.json({ success: true, data: [] }),
  getYouTubeDetails: (req: any, res: any) => res.json({ success: true, data: null }),
  getSpotifyDetails: (req: any, res: any) => res.json({ success: true, data: null }),
  getTrendingYouTube: (req: any, res: any) => res.json({ success: true, data: [] }),
  getSpotifyFeatured: (req: any, res: any) => res.json({ success: true, data: [] }),
  getSpotifyNewReleases: (req: any, res: any) => res.json({ success: true, data: [] }),
  importSong: (req: any, res: any) => res.json({ success: true, message: 'Song imported' }),
  markUnavailable: (req: any, res: any) => res.json({ success: true, message: 'Song marked unavailable' }),
  markAvailable: (req: any, res: any) => res.json({ success: true, message: 'Song marked available' }),
  getSongGenres: (req: any, res: any) => res.json({ success: true, data: [] }),
  bulkImportSongs: (req: any, res: any) => res.json({ success: true, message: 'Songs imported' }),
  getSongStats: (req: any, res: any) => res.json({ success: true, data: {} }),
  refreshSongCache: (req: any, res: any) => res.json({ success: true, message: 'Cache refreshed' })
};

const rateLimitMiddleware = (type: string, limit: number, window: number) => (req: any, res: any, next: any) => next();

const router = Router();

// Validation schemas
const createSongValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('artist')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Artist must be between 1 and 200 characters'),
  body('duration')
    .isInt({ min: 1, max: 3600 })
    .withMessage('Duration must be between 1 and 3600 seconds'),
  body('genre')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Genre must be less than 100 characters'),
  body('youtube_id')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage('Invalid YouTube ID format'),
  body('spotify_id')
    .optional()
    .trim()
    .matches(/^[0-9A-Za-z]{22}$/)
    .withMessage('Invalid Spotify ID format'),
  body('album')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Album must be less than 200 characters'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Invalid year'),
  body('explicit')
    .optional()
    .isBoolean()
    .withMessage('Explicit must be a boolean'),
  body('thumbnail_url')
    .optional()
    .isURL()
    .withMessage('Invalid thumbnail URL')
];

const updateSongValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('artist')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Artist must be between 1 and 200 characters'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 3600 })
    .withMessage('Duration must be between 1 and 3600 seconds'),
  body('genre')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Genre must be less than 100 characters'),
  body('youtube_id')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage('Invalid YouTube ID format'),
  body('spotify_id')
    .optional()
    .trim()
    .matches(/^[0-9A-Za-z]{22}$/)
    .withMessage('Invalid Spotify ID format'),
  body('album')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Album must be less than 200 characters'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Invalid year'),
  body('explicit')
    .optional()
    .isBoolean()
    .withMessage('Explicit must be a boolean'),
  body('thumbnail_url')
    .optional()
    .isURL()
    .withMessage('Invalid thumbnail URL'),
  body('is_available')
    .optional()
    .isBoolean()
    .withMessage('is_available must be a boolean')
];

const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),
  query('source')
    .optional()
    .isIn(['youtube', 'spotify', 'local'])
    .withMessage('Source must be youtube, spotify, or local'),
  query('genre')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Genre must be less than 100 characters'),
  query('min_duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('min_duration must be a positive integer'),
  query('max_duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('max_duration must be a positive integer'),
  query('available_only')
    .optional()
    .isBoolean()
    .withMessage('available_only must be a boolean'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const idValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid song ID format')
];

const youtubeSearchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),
  query('max_results')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('max_results must be between 1 and 50')
];

const spotifySearchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50'),
  query('market')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('market must be a 2-letter country code')
];

const youtubeIdValidation = [
  param('videoId')
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage('Invalid YouTube video ID format')
];

const spotifyIdValidation = [
  param('trackId')
    .matches(/^[0-9A-Za-z]{22}$/)
    .withMessage('Invalid Spotify track ID format')
];

const importSongValidation = [
  body('source')
    .isIn(['youtube', 'spotify'])
    .withMessage('Source must be youtube or spotify'),
  body('external_id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('External ID is required'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('artist')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Artist must be between 1 and 200 characters')
];

const markUnavailableValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
];

// Public routes (no authentication required)

// Search songs
router.get('/search',
  rateLimitMiddleware('search', 100, 15 * 60 * 1000), // 100 requests per 15 minutes
  searchValidation,
  handleValidationErrors,
  SongController.searchSongs
);

// Get song by ID
router.get('/:id',
  rateLimitMiddleware('general', 200, 15 * 60 * 1000),
  idValidation,
  handleValidationErrors,
  SongController.getSongById
);

// Get popular songs
router.get('/popular/list',
  rateLimitMiddleware('general', 100, 15 * 60 * 1000),
  query('genre').optional().trim().isLength({ max: 100 }),
  query('time_frame').optional().isIn(['day', 'week', 'month', 'year', 'all']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors,
  SongController.getPopularSongs
);

// Get recent songs
router.get('/recent/list',
  rateLimitMiddleware('general', 100, 15 * 60 * 1000),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors,
  SongController.getRecentSongs
);

// External API routes (require authentication)

// Search YouTube
router.get('/external/youtube/search',
  authenticateToken,
  rateLimitMiddleware('external_api', 50, 15 * 60 * 1000), // 50 requests per 15 minutes
  youtubeSearchValidation,
  handleValidationErrors,
  SongController.searchYouTube
);

// Get YouTube video details
router.get('/external/youtube/:videoId',
  authenticateToken,
  rateLimitMiddleware('external_api', 50, 15 * 60 * 1000),
  youtubeIdValidation,
  handleValidationErrors,
  SongController.getYouTubeDetails
);

// Get trending YouTube music
router.get('/external/youtube/trending/music',
  authenticateToken,
  rateLimitMiddleware('external_api', 20, 60 * 60 * 1000), // 20 requests per hour
  query('region_code').optional().isLength({ min: 2, max: 2 }),
  query('max_results').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  SongController.getTrendingYouTube
);

// Search Spotify
router.get('/external/spotify/search',
  authenticateToken,
  rateLimitMiddleware('external_api', 50, 15 * 60 * 1000),
  spotifySearchValidation,
  handleValidationErrors,
  SongController.searchSpotify
);

// Get Spotify track details
router.get('/external/spotify/:trackId',
  authenticateToken,
  rateLimitMiddleware('external_api', 50, 15 * 60 * 1000),
  spotifyIdValidation,
  handleValidationErrors,
  SongController.getSpotifyDetails
);

// Get Spotify featured playlists
router.get('/external/spotify/featured/playlists',
  authenticateToken,
  rateLimitMiddleware('external_api', 20, 60 * 60 * 1000),
  query('country').optional().isLength({ min: 2, max: 2 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  SongController.getSpotifyFeatured
);

// Get Spotify new releases
router.get('/external/spotify/new-releases',
  authenticateToken,
  rateLimitMiddleware('external_api', 20, 60 * 60 * 1000),
  query('country').optional().isLength({ min: 2, max: 2 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  SongController.getSpotifyNewReleases
);

// Admin/Bar Owner routes (require authentication and proper permissions)

// Create song (admin only)
router.post('/',
  authenticateToken,
  rateLimitMiddleware('create', 20, 60 * 60 * 1000), // 20 creates per hour
  createSongValidation,
  handleValidationErrors,
  SongController.createSong
);

// Update song (admin only)
router.put('/:id',
  authenticateToken,
  rateLimitMiddleware('update', 50, 60 * 60 * 1000), // 50 updates per hour
  idValidation,
  updateSongValidation,
  handleValidationErrors,
  SongController.updateSong
);

// Delete song (admin only)
router.delete('/:id',
  authenticateToken,
  rateLimitMiddleware('delete', 10, 60 * 60 * 1000), // 10 deletes per hour
  idValidation,
  handleValidationErrors,
  SongController.deleteSong
);

// Import song from external service
router.post('/import',
  authenticateToken,
  rateLimitMiddleware('import', 30, 60 * 60 * 1000), // 30 imports per hour
  importSongValidation,
  handleValidationErrors,
  SongController.importSong
);

// Mark song as unavailable
router.patch('/:id/unavailable',
  authenticateToken,
  rateLimitMiddleware('update', 50, 60 * 60 * 1000),
  idValidation,
  markUnavailableValidation,
  handleValidationErrors,
  SongController.markUnavailable
);

// Mark song as available
router.patch('/:id/available',
  authenticateToken,
  rateLimitMiddleware('update', 50, 60 * 60 * 1000),
  idValidation,
  handleValidationErrors,
  SongController.markAvailable
);

export default router;