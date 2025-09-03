import { Router } from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  deactivateUser
} from '../controllers/userController';
import { authenticate } from '../utils/jwt';
import { rateLimiter, rateLimitStrict } from '../middleware/rateLimiter';
import { requireRole } from '../middleware/auth';
import { validateContentType } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Alias for rate limiters
const rateLimitBasic = rateLimiter;

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin)
 */
router.get('/', 
  requireRole(['admin']),

  getUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Own profile or Admin)
 */
router.get('/:id', 
  rateLimitBasic,
  getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile
 * @access  Private (Own profile or Admin)
 */
router.put('/:id', 
  rateLimitBasic,
  updateUser
);

/**
 * @route   PUT /api/users/:id/deactivate
 * @desc    Deactivate user (admin only)
 * @access  Private (Admin)
 */
router.put('/:id/deactivate', 
  requireRole(['admin']),
  rateLimitStrict,
  deactivateUser
);

export default router;