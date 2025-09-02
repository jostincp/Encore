import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  getProfile,
  verifyEmail,
  changePassword,
  getActiveSessions,
  revokeSession
} from '../controllers/authController';
import { authenticateToken } from '../../../shared/utils/jwt';
import { 
  rateLimitAuth, 
  rateLimitStrict,
  validateContentType,
  validateJSON
} from '../../../shared/middleware';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', 
  rateLimitAuth,
  validateContentType,
  validateJSON,
  register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', 
  rateLimitAuth,
  validateContentType,
  validateJSON,
  login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', 
  rateLimitAuth,
  validateContentType,
  validateJSON,
  refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', 
  authenticateToken,
  validateContentType,
  validateJSON,
  logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post('/logout-all', 
  authenticateToken,
  rateLimitStrict,
  logoutAll
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', 
  authenticateToken,
  getProfile
);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user email
 * @access  Public
 */
router.get('/verify-email/:token', 
  rateLimitAuth,
  verifyEmail
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', 
  authenticateToken,
  rateLimitStrict,
  validateContentType,
  validateJSON,
  changePassword
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/sessions', 
  authenticateToken,
  getActiveSessions
);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', 
  authenticateToken,
  rateLimitStrict,
  revokeSession
);

export default router;