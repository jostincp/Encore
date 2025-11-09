import { Router, Request, Response } from 'express';
import {
  registerGuest,
  registerUser,
  registerBarOwner,
  createAdmin,
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
  registerBarOwnerSchema,
  createAdminSchema,
  validateRequest,
  validateParams
} from '../../../shared/utils/validation';

const router: Router = Router();

// Toggle de rate limit vía entorno
const skipRateLimit = process.env.DISABLE_RATE_LIMIT === 'true';
const noop = (req: Request, res: Response, next: Function) => next();
const rateLimitAuthMaybe = skipRateLimit ? noop : rateLimitAuth;

// Removed generic register route for security - use specific routes instead

/**
 * @route   POST /api/auth/register-guest
 * @desc    Register a new guest user
 * @access  Public
 */
router.post('/register-guest',
  rateLimitAuthMaybe,
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
  rateLimitAuthMaybe,
  validateContentType(['application/json']),
  registerUser
);

/**
 * @route   POST /api/auth/register-bar-owner
 * @desc    Register a new bar owner with basic bar creation
 * @access  Public
 */
router.post('/register-bar-owner',
  rateLimitAuthMaybe,
  validateContentType(['application/json']),
  validateRequest(registerBarOwnerSchema),
  registerBarOwner
);

/**
 * @route   POST /api/auth/create-admin
 * @desc    Crear usuario ADMIN (solo API, controlado por secreto)
 * @access  Private (header X-Admin-Create-Secret)
 */
router.post('/create-admin',
  rateLimitAuthMaybe,
  validateContentType(['application/json']),
  validateRequest(createAdminSchema),
  createAdmin
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  rateLimitAuthMaybe,
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
  rateLimitAuthMaybe,
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

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar recuperación de contraseña
 * @access  Public
 */
router.post('/forgot-password',
  rateLimitAuthMaybe,
  validateContentType(['application/json']),
  validateRequest(forgotPasswordSchema),
  forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Restablecer contraseña con token
 * @access  Public
 */
router.post('/reset-password',
  rateLimitAuthMaybe,
  validateContentType(['application/json']),
  validateRequest(resetPasswordSchema),
  resetPassword
);

// Session management routes removed - functions not implemented

export default router;