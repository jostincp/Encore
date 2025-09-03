import { Router } from 'express';
import {
  createBar,
  getBars,
  getBarById,
  updateBar,
  getMyBars,
  deactivateBar,
  activateBar,
  deleteBar,
  getBarSettings,
  updateBarSettings,
  getBarStats
} from '../controllers/barController';
import { authenticate } from '../middleware/auth';
import { rateLimiter as rateLimitBasic, rateLimitStrict } from '../middleware/rateLimiter';
import { requireRole } from '../middleware/auth';
import { validateContentType } from '../middleware/validation';

const router = Router();

/**
 * @route   GET /api/bars
 * @desc    Get all bars (public)
 * @access  Public
 */
router.get('/', 

  getBars
);

/**
 * @route   GET /api/bars/stats
 * @desc    Get bar statistics
 * @access  Private (Bar Owner or Admin)
 */
router.get('/stats', 
  authenticate,
  requireRole(['bar_owner', 'admin']),
  getBarStats
);

/**
 * @route   GET /api/bars/my
 * @desc    Get bars owned by current user
 * @access  Private (Bar Owner or Admin)
 */
router.get('/my', 
  authenticate,
  requireRole(['bar_owner', 'admin']),
  getMyBars
);

/**
 * @route   POST /api/bars
 * @desc    Create a new bar
 * @access  Private (Bar Owner or Admin)
 */
router.post('/', 
  authenticate,
  requireRole(['bar_owner', 'admin']),
  rateLimitBasic,
  validateContentType(['application/json']),
  createBar
);

/**
 * @route   GET /api/bars/:id
 * @desc    Get bar by ID
 * @access  Public
 */
router.get('/:id', 
  getBarById
);

/**
 * @route   PUT /api/bars/:id
 * @desc    Update bar
 * @access  Private (Bar Owner or Admin)
 */
router.put('/:id', 
  authenticate,
  rateLimitBasic,
  validateContentType(['application/json']),
  updateBar
);

/**
 * @route   PUT /api/bars/:id/deactivate
 * @desc    Deactivate bar
 * @access  Private (Bar Owner or Admin)
 */
router.put('/:id/deactivate', 
  authenticate,
  rateLimitStrict,
  deactivateBar
);

/**
 * @route   PUT /api/bars/:id/activate
 * @desc    Activate bar (admin only)
 * @access  Private (Admin)
 */
router.put('/:id/activate', 
  authenticate,
  requireRole(['admin']),
  rateLimitStrict,
  activateBar
);

/**
 * @route   DELETE /api/bars/:id
 * @desc    Delete bar (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', 
  authenticate,
  requireRole(['admin']),
  rateLimitStrict,
  deleteBar
);

/**
 * @route   GET /api/bars/:id/settings
 * @desc    Get bar settings
 * @access  Private (Bar Owner or Admin)
 */
router.get('/:id/settings', 
  authenticate,
  getBarSettings
);

/**
 * @route   PUT /api/bars/:id/settings
 * @desc    Update bar settings
 * @access  Private (Bar Owner or Admin)
 */
router.put('/:id/settings', 
  authenticate,
  rateLimitBasic,
  validateContentType(['application/json']),
  updateBarSettings
);

export default router;