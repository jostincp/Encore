import { Router, Request, Response } from 'express';
import {
  registerGuest,
  registerUser,
  registerBarOwner,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
  getProfile
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateContentType } from '../middleware/validation';
import { rateLimiter as rateLimitAuth, rateLimitStrict } from '../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  validateRequest,
  validateParams
} from '../../../shared/utils/validation';

const router: Router = Router();

// Removed generic register route for security - use specific routes instead

/**
 * @route   POST /api/auth/register-guest
 * @desc    Register a new guest user
 * @access  Public
 */
router.post('/register-guest',
  rateLimitAuth,
  validateContentType(['application/json']),
  registerGuest
);

/**
 * @route   POST /api/auth/register-user
 * @desc    Migrar GUEST a USER (registro)
 * @access  Privado (solo GUEST)
 */
router.post('/register-user',
  authenticate,
  rateLimitAuth,
  validateContentType(['application/json']),
  registerUser
);

/**
 * @route   POST /api/auth/register-bar-owner
 * @desc    Register a new bar owner with basic bar creation
 * @access  Public
 */
router.post('/register-bar-owner',
  rateLimitAuth,
  validateContentType(['application/json']),
  registerBarOwner
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  rateLimitAuth,
  validateContentType(['application/json']),
  validateRequest(loginSchema),
  login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh',
  rateLimitAuth,
  validateContentType(['application/json']),
  validateRequest(refreshTokenSchema),
  refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', 
  authenticate,
  validateContentType(['application/json']),
  logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post('/logout-all', 
  authenticate,
  rateLimitStrict,
  logout
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', 
  authenticate,
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
  authenticate,
  rateLimitStrict,
  validateContentType(['application/json']),
  changePassword
);

// Session management routes removed - functions not implemented

export default router;