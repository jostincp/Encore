/**
 * Encore Platform - Auth Service Controller Tests
 * Tests unitarios para el controlador de autenticación
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authController } from '../../../backend/auth-service/src/controllers/authController';
import { User } from '../../../backend/auth-service/src/models/User';
import { RefreshToken } from '../../../backend/auth-service/src/models/RefreshToken';
import { AppError } from '../../../backend/shared/utils/errors';

// Mocks
jest.mock('../../../backend/auth-service/src/models/User');
jest.mock('../../../backend/auth-service/src/models/RefreshToken');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../../backend/shared/utils/logger');

const mockUser = User as jest.Mocked<typeof User>;
const mockRefreshToken = RefreshToken as jest.Mocked<typeof RefreshToken>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      body: {},
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn()
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'ValidPass123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    it('should register a new user successfully', async () => {
      // Arrange
      mockRequest.body = validUserData;
      mockUser.findByEmail.mockResolvedValue(null);
      mockUser.create.mockResolvedValue({
        id: 1,
        email: validUserData.email,
        firstName: validUserData.firstName,
        lastName: validUserData.lastName,
        role: 'customer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);
      mockBcrypt.hash.mockResolvedValue('hashedPassword');
      mockJwt.sign
        .mockReturnValueOnce('accessToken')
        .mockReturnValueOnce('refreshToken');

      // Act
      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUser.findByEmail).toHaveBeenCalledWith(validUserData.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(validUserData.password, 12);
      expect(mockUser.create).toHaveBeenCalled();
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Usuario registrado exitosamente',
          data: expect.objectContaining({
            user: expect.any(Object),
            tokens: expect.objectContaining({
              accessToken: 'accessToken',
              refreshToken: 'refreshToken'
            })
          })
        })
      );
    });

    it('should return error if email already exists', async () => {
      // Arrange
      mockRequest.body = validUserData;
      mockUser.findByEmail.mockResolvedValue({
        id: 1,
        email: validUserData.email
      } as any);

      // Act
      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(mockUser.create).not.toHaveBeenCalled();
    });

    it('should validate input data', async () => {
      // Arrange
      mockRequest.body = {
        email: 'invalid-email',
        password: '123',
        firstName: '',
        lastName: ''
      };

      // Act
      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(mockUser.findByEmail).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      mockRequest.body = validUserData;
      mockUser.findByEmail.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(Error)
      );
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'ValidPass123!'
    };

    it('should login user successfully', async () => {
      // Arrange
      mockRequest.body = validLoginData;
      const mockUserInstance = {
        id: 1,
        email: validLoginData.email,
        password: 'hashedPassword',
        firstName: 'John',
        lastName: 'Doe',
        role: 'customer',
        isActive: true
      };
      mockUser.findByEmail.mockResolvedValue(mockUserInstance as any);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign
        .mockReturnValueOnce('accessToken')
        .mockReturnValueOnce('refreshToken');

      // Act
      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUser.findByEmail).toHaveBeenCalledWith(validLoginData.email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(validLoginData.password, 'hashedPassword');
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Login exitoso',
          data: expect.objectContaining({
            user: expect.any(Object),
            tokens: expect.objectContaining({
              accessToken: 'accessToken',
              refreshToken: 'refreshToken'
            })
          })
        })
      );
    });

    it('should return error for invalid credentials', async () => {
      // Arrange
      mockRequest.body = validLoginData;
      mockUser.findByEmail.mockResolvedValue(null);

      // Act
      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return error for incorrect password', async () => {
      // Arrange
      mockRequest.body = validLoginData;
      mockUser.findByEmail.mockResolvedValue({
        id: 1,
        email: validLoginData.email,
        password: 'hashedPassword'
      } as any);
      mockBcrypt.compare.mockResolvedValue(false);

      // Act
      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError)
      );
    });

    it('should return error for inactive user', async () => {
      // Arrange
      mockRequest.body = validLoginData;
      mockUser.findByEmail.mockResolvedValue({
        id: 1,
        email: validLoginData.email,
        password: 'hashedPassword',
        isActive: false
      } as any);

      // Act
      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      const refreshTokenValue = 'validRefreshToken';
      mockRequest.body = { refreshToken: refreshTokenValue };

      const mockRefreshTokenInstance = {
        id: 1,
        token: refreshTokenValue,
        userId: 1,
        expiresAt: new Date(Date.now() + 86400000), // Future date
        isRevoked: false,
        user: {
          id: 1,
          email: 'test@example.com',
          role: 'customer'
        }
      };

      mockRefreshToken.findByToken.mockResolvedValue(mockRefreshTokenInstance as any);
      mockJwt.verify.mockReturnValue({ sub: 1, email: 'test@example.com' });
      mockJwt.sign
        .mockReturnValueOnce('newAccessToken')
        .mockReturnValueOnce('newRefreshToken');

      // Act
      await authController.refreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRefreshToken.findByToken).toHaveBeenCalledWith(refreshTokenValue);
      expect(mockJwt.verify).toHaveBeenCalledWith(refreshTokenValue, expect.any(String));
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            tokens: expect.objectContaining({
              accessToken: 'newAccessToken',
              refreshToken: 'newRefreshToken'
            })
          })
        })
      );
    });

    it('should return error for invalid refresh token', async () => {
      // Arrange
      mockRequest.body = { refreshToken: 'invalidToken' };
      mockRefreshToken.findByToken.mockResolvedValue(null);

      // Act
      await authController.refreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError)
      );
    });

    it('should return error for expired refresh token', async () => {
      // Arrange
      mockRequest.body = { refreshToken: 'expiredToken' };
      mockRefreshToken.findByToken.mockResolvedValue({
        id: 1,
        token: 'expiredToken',
        expiresAt: new Date(Date.now() - 86400000), // Past date
        isRevoked: false
      } as any);

      // Act
      await authController.refreshToken(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError)
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      // Arrange
      const refreshTokenValue = 'validRefreshToken';
      mockRequest.body = { refreshToken: refreshTokenValue };

      mockRefreshToken.revokeToken.mockResolvedValue(1);

      // Act
      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRefreshToken.revokeToken).toHaveBeenCalledWith(refreshTokenValue);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logout exitoso'
        })
      );
    });

    it('should handle logout without refresh token', async () => {
      // Arrange
      mockRequest.body = {};

      // Act
      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRefreshToken.revokeToken).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      // Arrange
      const mockUserInstance = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'customer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockRequest.user = mockUserInstance;

      // Act
      await authController.getProfile(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 1,
              email: 'test@example.com',
              firstName: 'John',
              lastName: 'Doe'
            })
          })
        })
      );
    });

    it('should return error if user not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await authController.getProfile(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.any(AppError)
      );
    });
  });
});