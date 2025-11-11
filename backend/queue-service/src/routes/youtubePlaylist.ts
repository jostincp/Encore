import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../../../shared/utils/jwt';
import YouTubePlaylistController from '../controllers/YouTubePlaylistController';

const router = Router();

// Simple validation error handler compatible with express-validator
function handleValidationErrors(req: any, res: any, next: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
}

// Validation schemas
const createPlaylistValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Playlist name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

const addVideoValidation = [
  param('playlistId')
    .isString()
    .withMessage('Playlist ID is required'),
  body('videoId')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Video ID is required'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required'),
  body('channelTitle')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Channel title is required'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  body('thumbnailUrl')
    .isURL()
    .withMessage('Thumbnail URL must be a valid URL')
];

const updatePlaylistValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Playlist name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

const reorderItemsValidation = [
  body('itemIds')
    .isArray({ min: 1 })
    .withMessage('itemIds must be a non-empty array'),
  body('itemIds.*')
    .isString()
    .withMessage('Each item ID must be a string')
];

// Routes

// Create a new YouTube playlist
router.post('/playlists',
  authenticateToken,
  createPlaylistValidation,
  handleValidationErrors,
  YouTubePlaylistController.createPlaylist
);

// Get all playlists for the user's bar
router.get('/playlists',
  authenticateToken,
  YouTubePlaylistController.getBarPlaylists
);

// Get a specific playlist
router.get('/playlists/:playlistId',
  authenticateToken,
  param('playlistId').isString().withMessage('Playlist ID is required'),
  handleValidationErrors,
  YouTubePlaylistController.getPlaylist
);

// Add a video to a playlist
router.post('/playlists/:playlistId/videos',
  authenticateToken,
  addVideoValidation,
  handleValidationErrors,
  YouTubePlaylistController.addVideoToPlaylist
);

// Remove a video from a playlist
router.delete('/playlists/:playlistId/videos/:itemId',
  authenticateToken,
  param('playlistId').isString().withMessage('Playlist ID is required'),
  param('itemId').isString().withMessage('Item ID is required'),
  handleValidationErrors,
  YouTubePlaylistController.removeVideoFromPlaylist
);

// Reorder videos in a playlist
router.put('/playlists/:playlistId/reorder',
  authenticateToken,
  param('playlistId').isString().withMessage('Playlist ID is required'),
  reorderItemsValidation,
  handleValidationErrors,
  YouTubePlaylistController.reorderPlaylistItems
);

// Update playlist information
router.put('/playlists/:playlistId',
  authenticateToken,
  param('playlistId').isString().withMessage('Playlist ID is required'),
  updatePlaylistValidation,
  handleValidationErrors,
  YouTubePlaylistController.updatePlaylist
);

// Delete a playlist
router.delete('/playlists/:playlistId',
  authenticateToken,
  param('playlistId').isString().withMessage('Playlist ID is required'),
  handleValidationErrors,
  YouTubePlaylistController.deletePlaylist
);

export default router;