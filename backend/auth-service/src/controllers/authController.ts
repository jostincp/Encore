import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { 
  asyncHandler, 
  sendSuccess, 
  sendError, 
  ValidationError, 
  UnauthorizedError, 
  ConflictError,
  BadRequestError
} from '../../../shared/utils/errors';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  AuthenticatedRequest 
} from '../../../shared/utils/jwt';
import { validateUserRegistration, validateEmail } from '../../../shared/utils/validation';
import { UserModel } from '../models/User';
import { BarModel } from '../models/Bar';
import { RefreshTokenModel } from '../models/RefreshToken';
import { logger } from '../../../shared/utils/logger';
import { User, Bar } from '../../../shared/types';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role = 'customer' } = req.body;

  // Validate input
  const validation = validateUserRegistration({ email, password, firstName, lastName, role });
  if (!validation.isValid) {
    throw new ValidationError('Datos de registro inválidos', validation.errors);
  }

  // Check if user already exists
  const existingUser = await UserModel.findByEmail(email);
  if (existingUser) {
    throw new ConflictError('El usuario ya existe con este email');
  }

  // Create user
  const user = await UserModel.create({
    email,
    password,
    firstName,
    lastName,
    role: role as 'customer' | 'bar_owner' | 'admin'
  });

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshTokenData = await RefreshTokenModel.create(
    user.id, 
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  );

  logger.info('User registered successfully', { userId: user.id, email: user.email });

  sendSuccess(res, {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive
    },
    accessToken,
    refreshToken: refreshTokenData.token
  }, 'Usuario registrado exitosamente', 201);
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new BadRequestError('Email y contraseña son requeridos');
  }

  if (!validateEmail(email)) {
    throw new ValidationError('Email inválido');
  }

  // Find user with password
  const user = await UserModel.findByEmailWithPassword(email);
  if (!user) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new UnauthorizedError('Cuenta desactivada');
  }

  // Verify password
  const isValidPassword = await UserModel.verifyPassword(user.id, password);
  if (!isValidPassword) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshTokenData = await RefreshTokenModel.create(
    user.id, 
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  );

  logger.info('User logged in successfully', { userId: user.id, email: user.email });

  sendSuccess(res, {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive
    },
    accessToken,
    refreshToken: refreshTokenData.token
  }, 'Inicio de sesión exitoso');
});

/**
 * Refresh access token
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new BadRequestError('Refresh token es requerido');
  }

  // Validate refresh token
  const validation = await RefreshTokenModel.validateToken(token);
  if (!validation.isValid || !validation.userId) {
    throw new UnauthorizedError('Refresh token inválido o expirado');
  }

  // Get user
  const user = await UserModel.findById(validation.userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Usuario no encontrado o inactivo');
  }

  // Generate new access token
  const accessToken = generateAccessToken({ userId: user.id, role: user.role });

  // Optionally rotate refresh token (create new one)
  const newRefreshTokenData = await RefreshTokenModel.rotate(
    token,
    user.id,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  );

  if (!newRefreshTokenData) {
    throw new UnauthorizedError('Error al rotar refresh token');
  }

  logger.info('Token refreshed successfully', { userId: user.id });

  sendSuccess(res, {
    accessToken,
    refreshToken: newRefreshTokenData.token
  }, 'Token renovado exitosamente');
});

/**
 * Logout user
 */
export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken: token } = req.body;
  const userId = req.user?.userId;

  if (token) {
    // Revoke specific refresh token
    const tokenData = await RefreshTokenModel.findByToken(token);
    if (tokenData && tokenData.userId === userId) {
      await RefreshTokenModel.revoke(tokenData.id);
    }
  } else if (userId) {
    // Revoke all refresh tokens for user
    await RefreshTokenModel.revokeAllForUser(userId);
  }

  logger.info('User logged out', { userId });

  sendSuccess(res, null, 'Sesión cerrada exitosamente');
});

/**
 * Logout from all devices
 */
export const logoutAll = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('Usuario no autenticado');
  }

  // Revoke all refresh tokens for user
  const revokedCount = await RefreshTokenModel.revokeAllForUser(userId);

  logger.info('User logged out from all devices', { userId, revokedTokens: revokedCount });

  sendSuccess(res, { revokedTokens: revokedCount }, 'Sesión cerrada en todos los dispositivos');
});

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('Usuario no autenticado');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new UnauthorizedError('Usuario no encontrado');
  }

  // If user is bar owner, get their bars
  let bars: Bar[] = [];
  if (user.role === 'bar_owner') {
    bars = await BarModel.findByOwnerId(userId);
  }

  sendSuccess(res, {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    },
    bars
  }, 'Perfil obtenido exitosamente');
});

/**
 * Verify email
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token) {
    throw new BadRequestError('Token de verificación requerido');
  }

  // In a real implementation, you would verify the token and get the user ID
  // For now, we'll assume the token contains the user ID (this should be properly implemented)
  // This is a simplified version - in production, use proper email verification tokens
  
  try {
    const decoded = verifyRefreshToken(token) as any;
    const userId = decoded.userId;

    const success = await UserModel.verifyEmail(userId);
    if (!success) {
      throw new BadRequestError('Token de verificación inválido');
    }

    logger.info('Email verified successfully', { userId });

    sendSuccess(res, null, 'Email verificado exitosamente');
  } catch (error) {
    throw new BadRequestError('Token de verificación inválido');
  }
});

/**
 * Change password
 */
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('Usuario no autenticado');
  }

  if (!currentPassword || !newPassword) {
    throw new BadRequestError('Contraseña actual y nueva son requeridas');
  }

  // Verify current password
  const isValidPassword = await UserModel.verifyPassword(userId, currentPassword);
  if (!isValidPassword) {
    throw new UnauthorizedError('Contraseña actual incorrecta');
  }

  // Update password
  const success = await UserModel.updatePassword(userId, newPassword);
  if (!success) {
    throw new BadRequestError('Error al actualizar contraseña');
  }

  // Revoke all refresh tokens to force re-login
  await RefreshTokenModel.revokeAllForUser(userId);

  logger.info('Password changed successfully', { userId });

  sendSuccess(res, null, 'Contraseña actualizada exitosamente');
});

/**
 * Get active sessions
 */
export const getActiveSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('Usuario no autenticado');
  }

  const sessions = await RefreshTokenModel.findActiveByUserId(userId);

  sendSuccess(res, {
    sessions: sessions.map(session => ({
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    }))
  }, 'Sesiones activas obtenidas exitosamente');
});

/**
 * Revoke session
 */
export const revokeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('Usuario no autenticado');
  }

  if (!sessionId) {
    throw new BadRequestError('ID de sesión requerido');
  }

  // Verify session belongs to user
  const session = await RefreshTokenModel.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new BadRequestError('Sesión no encontrada');
  }

  const success = await RefreshTokenModel.revoke(sessionId);
  if (!success) {
    throw new BadRequestError('Error al revocar sesión');
  }

  logger.info('Session revoked', { userId, sessionId });

  sendSuccess(res, null, 'Sesión revocada exitosamente');
});