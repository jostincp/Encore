import { Router } from 'express';
import { query, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import YouTubeController from '../controllers/youtubeControllerNew';

// Validation schemas
const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
];

const videoIdValidation = [
  param('id')
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage('Invalid YouTube video ID format')
];

const trendingValidation = [
  query('region')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Region must be a 2-letter country code')
];

const router = Router();

// ==============================================
// YOUTUBE API ROUTES
// ==============================================

// Search YouTube videos
router.get('/search',
  searchValidation,
  handleValidationErrors,
  YouTubeController.search
);

// Get video details by ID
router.get('/video/:id',
  videoIdValidation,
  handleValidationErrors,
  YouTubeController.getVideoDetails
);

// Get trending music videos
router.get('/trending',
  trendingValidation,
  handleValidationErrors,
  YouTubeController.getTrending
);

export default router;
