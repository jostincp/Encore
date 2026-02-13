import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import barRoutes from './bars';
import tokenValidationRoutes from './tokenValidation';
import { healthCheck } from '../middleware/healthCheck';

const router: Router = Router();

// Health check endpoint
router.get('/health', healthCheck);
// Health check under /auth for clients expecting /api/auth/health
router.get('/auth/health', healthCheck);

// API routes
router.use('/auth', authRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bars', barRoutes);
router.use('/t', tokenValidationRoutes); // Validación QR por token (pública)

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'Encore Authentication Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: {
        'POST /auth/register': 'Register a new user',
        'POST /auth/login': 'Login user',
        'POST /auth/refresh': 'Refresh access token',
        'POST /auth/logout': 'Logout user',
        'POST /auth/logout-all': 'Logout from all devices',
        'GET /auth/profile': 'Get user profile',
        'GET /auth/verify-email/:token': 'Verify email',
        'PUT /auth/change-password': 'Change password',
        'GET /auth/sessions': 'Get active sessions',
        'DELETE /auth/sessions/:sessionId': 'Revoke session'
      },
      users: {
        'GET /users': 'Get all users (admin)',
        'GET /users/stats': 'Get user statistics (admin)',
        'GET /users/:id': 'Get user by ID',
        'PUT /users/:id': 'Update user profile',
        'PUT /users/:id/role': 'Update user role (admin)',
        'PUT /users/:id/deactivate': 'Deactivate user (admin)',
        'PUT /users/:id/activate': 'Activate user (admin)',
        'DELETE /users/:id': 'Delete user (admin)'
      },
      bars: {
        'GET /bars': 'Get all bars',
        'GET /bars/my': 'Get my bars',
        'POST /bars': 'Create bar',
        'POST /bars/:barId/tables': 'Create table with QR token',
        'GET /bars/:barId/tables': 'Get bar tables',
        'GET /bars/:barId/tables/:tableId/qr': 'Get QR for table',
        'POST /bars/:barId/tables/:tableId/rotate-qr': 'Rotate QR token',
        'GET /bars/:barId/tables-analytics': 'QR scan analytics'
      },
      qr: {
        'GET /t/:token': 'Validate QR token (public)'
      }
    },
    timestamp: new Date().toISOString()
  });
});

export default router;