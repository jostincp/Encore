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
import { authenticateToken, requireRole } from '../../../shared/utils/jwt';
import { 
  rateLimitBasic,
  rateLimitStrict,
  validateContentType,
  validateJSON,
  validatePagination
} from '../../../shared/middleware';

const router = Router();

/**
 * @route   GET /api/bars
 * @desc    Get all bars (public)
 * @access  Public
 */
router.get('/', 
  validatePagination,
  getBars
);

/**
 * @route   GET /api/bars/stats
 * @desc    Get bar statistics
 * @access  Private (Bar Owner or Admin)
 */
router.get('/stats', 
  authenticateToken,
  requireRole(['bar_owner', 'admin']),
  getBarStats
);

/**
 * @route   GET /api/bars/my
 * @desc    Get bars owned by current user
 * @access  Private (Bar Owner or Admin)
 */
router.get('/my', 
  authenticateToken,
  requireRole(['bar_owner', 'admin']),
  getMyBars
);

/**
 * @route   POST /api/bars
 * @desc    Create a new bar
 * @access  Private (Bar Owner or Admin)
 */
router.post('/', 
  authenticateToken,
  requireRole(['bar_owner', 'admin']),
  rateLimitBasic,
  validateContentType,
  validateJSON,
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
  authenticateToken,
  rateLimitBasic,
  validateContentType,
  validateJSON,
  updateBar
);

/**
 * @route   PUT /api/bars/:id/deactivate
 * @desc    Deactivate bar
 * @access  Private (Bar Owner or Admin)
 */
router.put('/:id/deactivate', 
  authenticateToken,
  rateLimitStrict,
  deactivateBar
);

/**
 * @route   PUT /api/bars/:id/activate
 * @desc    Activate bar (admin only)
 * @access  Private (Admin)
 */
router.put('/:id/activate', 
  authenticateToken,
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
  authenticateToken,
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
  authenticateToken,
  getBarSettings
);

/**
 * @route   PUT /api/bars/:id/settings
 * @desc    Update bar settings
 * @access  Private (Bar Owner or Admin)
 */
router.put('/:id/settings', 
  authenticateToken,
  rateLimitBasic,
  validateContentType,
  validateJSON,
  updateBarSettings
);

export default router;