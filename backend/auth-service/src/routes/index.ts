import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import barRoutes from './bars';
import { healthCheck } from '../middleware/healthCheck';

const router: Router = Router();

// Health check endpoint
router.get('/health', healthCheck);

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bars', barRoutes);

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
        'GET /bars/stats': 'Get bar statistics',
        'GET /bars/my': 'Get my bars',
        'POST /bars': 'Create bar',
        'GET /bars/:id': 'Get bar by ID',
        'PUT /bars/:id': 'Update bar',
        'PUT /bars/:id/deactivate': 'Deactivate bar',
        'PUT /bars/:id/activate': 'Activate bar (admin)',
        'DELETE /bars/:id': 'Delete bar (admin)',
        'GET /bars/:id/settings': 'Get bar settings',
        'PUT /bars/:id/settings': 'Update bar settings'
      }
    },
    timestamp: new Date().toISOString()
  });
});

export default router;