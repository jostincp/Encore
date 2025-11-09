import { AuthController } from '../../../src/controllers/authController';
import { UserModel } from '../../../src/models/User';
import { EmailService } from '../../../src/services/emailService';
import { AppError } from '../../../../shared/utils/errors';
import {
  mockRequest,
  mockResponse,
  mockNext,
  mockUser,
  mockDbQuery,
  mockDbError,
  mockJwtSign,
  mockRedisSet,
  expectError
} from '../../setup';

// Mock dependencies
jest.mock('../../../src/models/User');
jest.mock('../../../src/services/emailService');
jest.mock('../../../../shared/utils/errors');

describe('AuthController', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext;
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'Password123!',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };

    it('should register a new user successfully', async () => {
      req.body = validRegisterData;
      
      // Mock UserModel.findByEmail to return null (user doesn't exist)
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      
      // Mock UserModel.create to return new user
      const newUser = { ...mockUser, ...validRegisterData };
      (UserModel.create as jest.Mock).mockResolvedValue(newUser);
      
      // Mock EmailService.sendVerificationEmail
      (EmailService.sendVerificationEmail as jest.Mock).mockResolvedValue(true);
      
      await AuthController.register(req, res, next);
      
      expect(UserModel.findByEmail).toHaveBeenCalledWith(validRegisterData.email);
      expect(UserModel.create).toHaveBeenCalledWith(expect.objectContaining({
        email: validRegisterData.email,
        username: validRegisterData.username,
        first_name: validRegisterData.first_name,
        last_name: validRegisterData.last_name,
        role: validRegisterData.role
      }));
      expect(EmailService.sendVerificationEmail).toHaveBeenCalledWith(
        validRegisterData.email,
        expect.any(String)
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.',
        data: {
          user: expect.objectContaining({
            id: newUser.id,
            email: newUser.email,
            username: newUser.username
          })
        }
      });
    });

    it('should return error if user already exists', async () => {
      req.body = validRegisterData;
      
      // Mock UserModel.findByEmail to return existing user
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      
      await AuthController.register(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User with this email already exists',
          statusCode: 400
        })
      );
    });

    it('should handle database errors', async () => {
      req.body = validRegisterData;
      
      const dbError = new Error('Database connection failed');
      (UserModel.findByEmail as jest.Mock).mockRejectedValue(dbError);
      
      await AuthController.register(req, res, next);
      
      expect(next).toHaveBeenCalledWith(dbError);
    });

    it('should validate required fields', async () => {
      req.body = { email: 'test@example.com' }; // Missing required fields
      
      await AuthController.register(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('required'),
          statusCode: 400
        })
      );
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should login user successfully', async () => {
      req.body = validLoginData;
      
      // Mock UserModel.findByEmail to return user
      const user = { ...mockUser, is_verified: true };
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(user);
      
      // Mock password comparison
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockResolvedValue(true);
      
      // Mock JWT token generation
      mockJwtSign({ id: user.id, email: user.email });
      
      await AuthController.login(req, res, next);
      
      expect(UserModel.findByEmail).toHaveBeenCalledWith(validLoginData.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(validLoginData.password, user.password_hash);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: expect.objectContaining({
            id: user.id,
            email: user.email,
            username: user.username
          }),
          token: expect.any(String),
          refreshToken: expect.any(String)
        }
      });
    });

    it('should return error for invalid credentials', async () => {
      req.body = validLoginData;
      
      // Mock UserModel.findByEmail to return null
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      
      await AuthController.login(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid credentials',
          statusCode: 401
        })
      );
    });

    it('should return error for unverified user', async () => {
      req.body = validLoginData;
      
      // Mock UserModel.findByEmail to return unverified user
      const unverifiedUser = { ...mockUser, is_verified: false };
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(unverifiedUser);
      
      await AuthController.login(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Please verify your email before logging in',
          statusCode: 401
        })
      );
    });

    it('should return error for wrong password', async () => {
      req.body = validLoginData;
      
      const user = { ...mockUser, is_verified: true };
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(user);
      
      // Mock password comparison to return false
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockResolvedValue(false);
      
      await AuthController.login(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid credentials',
          statusCode: 401
        })
      );
    });
  });

  describe('verifyEmail', () => {
    const validToken = 'valid-verification-token';

    it('should verify email successfully', async () => {
      req.params = { token: validToken };
      
      // Mock JWT verification
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({ email: 'test@example.com' });
      
      // Mock UserModel.findByEmail to return unverified user
      const unverifiedUser = { ...mockUser, is_verified: false };
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(unverifiedUser);
      
      // Mock UserModel.update
      (UserModel.update as jest.Mock).mockResolvedValue({
        ...unverifiedUser,
        is_verified: true
      });
      
      await AuthController.verifyEmail(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith(validToken, expect.any(String));
      expect(UserModel.update).toHaveBeenCalledWith(unverifiedUser.id, {
        is_verified: true,
        email_verified_at: expect.any(Date)
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Email verified successfully'
      });
    });

    it('should return error for invalid token', async () => {
      req.params = { token: 'invalid-token' };
      
      // Mock JWT verification to throw error
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await AuthController.verifyEmail(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid or expired verification token',
          statusCode: 400
        })
      );
    });

    it('should return error if user not found', async () => {
      req.params = { token: validToken };
      
      // Mock JWT verification
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({ email: 'nonexistent@example.com' });
      
      // Mock UserModel.findByEmail to return null
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      
      await AuthController.verifyEmail(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
          statusCode: 404
        })
      );
    });
  });

  describe('forgotPassword', () => {
    const validEmail = 'test@example.com';

    it('should send password reset email successfully', async () => {
      req.body = { email: validEmail };
      
      // Mock UserModel.findByEmail to return user
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock EmailService.sendPasswordResetEmail
      (EmailService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(true);
      
      await AuthController.forgotPassword(req, res, next);
      
      expect(UserModel.findByEmail).toHaveBeenCalledWith(validEmail);
      expect(EmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        validEmail,
        expect.any(String)
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset email sent successfully'
      });
    });

    it('should return success even if user not found (security)', async () => {
      req.body = { email: 'nonexistent@example.com' };
      
      // Mock UserModel.findByEmail to return null
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      
      await AuthController.forgotPassword(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset email sent successfully'
      });
      expect(EmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const validToken = 'valid-reset-token';
    const newPassword = 'NewPassword123!';

    it('should reset password successfully', async () => {
      req.body = { token: validToken, password: newPassword };
      
      // Mock JWT verification
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({ email: 'test@example.com' });
      
      // Mock UserModel.findByEmail to return user
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock password hashing
      const bcrypt = require('bcrypt');
      bcrypt.hash.mockResolvedValue('hashed-new-password');
      
      // Mock UserModel.update
      (UserModel.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        password_hash: 'hashed-new-password'
      });
      
      await AuthController.resetPassword(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith(validToken, expect.any(String));
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(UserModel.update).toHaveBeenCalledWith(mockUser.id, {
        password_hash: 'hashed-new-password',
        password_reset_at: expect.any(Date)
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully'
      });
    });

    it('should return error for invalid token', async () => {
      req.body = { token: 'invalid-token', password: newPassword };
      
      // Mock JWT verification to throw error
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await AuthController.resetPassword(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid or expired reset token',
          statusCode: 400
        })
      );
    });
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';

    it('should refresh token successfully', async () => {
      req.body = { refreshToken: validRefreshToken };
      
      // Mock JWT verification
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({ id: mockUser.id, email: mockUser.email });
      
      // Mock UserModel.findById to return user
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);
      
      // Mock new token generation
      mockJwtSign({ id: mockUser.id, email: mockUser.email });
      
      await AuthController.refreshToken(req, res, next);
      
      expect(jwt.verify).toHaveBeenCalledWith(validRefreshToken, expect.any(String));
      expect(UserModel.findById).toHaveBeenCalledWith(mockUser.id);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: expect.any(String),
          refreshToken: expect.any(String)
        }
      });
    });

    it('should return error for invalid refresh token', async () => {
      req.body = { refreshToken: 'invalid-token' };
      
      // Mock JWT verification to throw error
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await AuthController.refreshToken(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid refresh token',
          statusCode: 401
        })
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      req.user = mockUser;
      
      // Mock Redis operations
      mockRedisSet();
      
      await AuthController.logout(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });
});