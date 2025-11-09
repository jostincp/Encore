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
import { UserRole } from '../constants/roles'; 
import { validateContentType } from '../middleware/validation';

const router: Router = Router();

/**
 * @route   GET /api/bars
 * @desc    Get all bars (public)
 * @access  Public
 */
router.get('/', 

  getBars
);

/**
 * @route   GET /api/bars/stats
 * @desc    Get bar statistics
 * @access  Private (Bar Owner o Super Admin)
 */
router.get('/stats',
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  getBarStats
);

/**
 * @route   GET /api/bars/my
 * @desc    Get bars owned by current user
 * @access  Private (Bar Owner o Super Admin)
 */
router.get('/my',
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  getMyBars
);

/**
 * @route   POST /api/bars
 * @desc    Create a new bar
 * @access  Private (Bar Owner o Super Admin)
 */
router.post('/',
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
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
 * @route   PUT /api/bars/:id
 * @desc    Update bar
 * @access  Private (Bar Owner o Super Admin)
 */
router.put('/:id',
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  rateLimitBasic,
  validateContentType(['application/json']),
  updateBar
);

/**
 * @route   PATCH /api/bars/:id
 * @desc    Complete bar profile (progressive registration)
 * @access  Private (Bar Owner o Super Admin)
 */
router.patch('/:id',
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  rateLimitBasic,
  validateContentType(['application/json']),
  updateBar
);

/**
 * @route   PUT /api/bars/:id/deactivate
 * @desc    Deactivate bar
 * @access  Private (Bar Owner o Super Admin)
 */
router.put('/:id/deactivate', 
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  rateLimitStrict,
  deactivateBar
);

/**
 * @route   PUT /api/bars/:id/activate
 * @desc    Activate bar (Super Admin solo)
 * @access  Private (Super Admin)
 */
router.put('/:id/activate', 
  authenticate,
  requireRole([UserRole.ADMIN]),
  rateLimitStrict,
  activateBar
);

/**
 * @route   DELETE /api/bars/:id
 * @desc    Eliminar bar (solo ADMIN)
 * @access  Privado (ADMIN)
 */
router.delete('/:id', 
  authenticate,
  requireRole([UserRole.ADMIN]),
  rateLimitStrict,
  deleteBar
);

/**
 * @route   GET /api/bars/:id/settings
 * @desc    Get bar settings
 * @access  Privado (BAR_OWNER o ADMIN)
 */
router.get('/:id/settings', 
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  getBarSettings
);

/**
 * @route   PUT /api/bars/:id/settings
 * @desc    Update bar settings
 * @access  Privado (BAR_OWNER o ADMIN)
 */
router.put('/:id/settings', 
  authenticate,
  requireRole([UserRole.BAR_OWNER, UserRole.ADMIN]),
  rateLimitBasic,
  validateContentType(['application/json']),
  updateBarSettings
);

export default router;