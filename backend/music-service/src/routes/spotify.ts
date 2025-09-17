import { Router } from 'express';
import { query, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import SpotifyController from '../controllers/spotifyController';
import {
  spotifySearchLimiter,
  spotifyTrackLimiter,
  spotifyRecommendationsLimiter,
  spotifyPlaylistsLimiter,
  spotifyGeneralLimiter
} from '../middleware/spotifyRateLimiter';

const router = Router();

// Validation schemas
const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  query('market')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Market must be a 2-letter country code')
];

const trackIdValidation = [
  param('trackId')
    .matches(/^[0-9A-Za-z]{22}$/)
    .withMessage('Invalid Spotify track ID format')
];

const recommendationsValidation = [
  query('seed_tracks')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Seed tracks must be provided'),
  query('seed_artists')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Seed artists must be provided'),
  query('seed_genres')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Seed genres must be provided'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  // Audio features validation
  query('target_danceability')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Danceability must be between 0 and 1'),
  query('target_energy')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Energy must be between 0 and 1'),
  query('target_valence')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Valence must be between 0 and 1'),
  query('target_acousticness')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Acousticness must be between 0 and 1'),
  query('target_instrumentalness')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Instrumentalness must be between 0 and 1'),
  query('target_liveness')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Liveness must be between 0 and 1'),
  query('target_speechiness')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Speechiness must be between 0 and 1')
];

const playlistsValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('country')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be a 2-letter country code')
];

const newReleasesValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('country')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be a 2-letter country code')
];

// ==============================================
// SPOTIFY API ROUTES
// ==============================================

// Buscar tracks en Spotify
router.get('/search',
  authenticateToken,
  spotifySearchLimiter,
  searchValidation,
  handleValidationErrors,
  SpotifyController.searchTracks
);

// Obtener detalles de un track
router.get('/tracks/:trackId',
  authenticateToken,
  spotifyTrackLimiter,
  trackIdValidation,
  handleValidationErrors,
  SpotifyController.getTrackDetails
);

// Obtener recomendaciones
router.get('/recommendations',
  authenticateToken,
  spotifyRecommendationsLimiter,
  recommendationsValidation,
  handleValidationErrors,
  SpotifyController.getRecommendations
);

// Obtener playlists destacadas
router.get('/featured-playlists',
  authenticateToken,
  spotifyPlaylistsLimiter,
  playlistsValidation,
  handleValidationErrors,
  SpotifyController.getFeaturedPlaylists
);

// Obtener nuevos lanzamientos
router.get('/new-releases',
  authenticateToken,
  spotifyPlaylistsLimiter,
  newReleasesValidation,
  handleValidationErrors,
  SpotifyController.getNewReleases
);

// ==============================================
// ADMIN/MONITORING ROUTES
// ==============================================

// Obtener estadísticas del servicio
router.get('/stats',
  authenticateToken,
  spotifyGeneralLimiter,
  SpotifyController.getServiceStats
);

// Invalidar caché (solo admin)
router.post('/cache/invalidate',
  authenticateToken,
  spotifyGeneralLimiter,
  query('pattern')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Pattern must be less than 100 characters'),
  handleValidationErrors,
  SpotifyController.invalidateCache
);

export default router;