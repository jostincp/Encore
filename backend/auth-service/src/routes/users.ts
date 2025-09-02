import { Router } from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  deactivateUser,
  activateUser,
  deleteUser,
  updateUserRole,
  getUserStats
} from '../controllers/userController';
import { authenticateToken, requireRole } from '../../../shared/utils/jwt';
import { 
  rateLimitBasic,
  rateLimitStrict,
  validateContentType,
  validateJSON,
  validatePagination
} from '../../../shared/middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin)
 */
router.get('/', 
  requireRole(['admin']),
  validatePagination,
  getUsers
);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics (admin only)
 * @access  Private (Admin)
 */
router.get('/stats', 
  requireRole(['admin']),
  getUserStats
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
  validateContentType,
  validateJSON,
  updateUser
);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role (admin only)
 * @access  Private (Admin)
 */
router.put('/:id/role', 
  requireRole(['admin']),
  rateLimitStrict,
  validateContentType,
  validateJSON,
  updateUserRole
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

/**
 * @route   PUT /api/users/:id/activate
 * @desc    Activate user (admin only)
 * @access  Private (Admin)
 */
router.put('/:id/activate', 
  requireRole(['admin']),
  rateLimitStrict,
  activateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', 
  requireRole(['admin']),
  rateLimitStrict,
  deleteUser
);

export default router;