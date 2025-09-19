import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { UserModel, User } from '../models/User';
import { RefreshTokenModel, RefreshToken } from '../models/RefreshToken';
import { BarModel, Bar } from '../models/Bar';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';
import { ValidationError, UnauthorizedError, ConflictError, NotFoundError, BadRequestError } from '../utils/errors';
import { RequestWithUser } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  validateEmail,
  validatePassword,
  validateNonEmptyString as validateUsername
} from '../utils/validation';
import { config } from '../../../shared/config';

// Simple sanitize function
const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

// Models are imported directly above

// Validation functions mejoradas
const validateUserRegistration = (data: any) => {
  const errors: string[] = [];
  
  // Sanitizar inputs
  const sanitizedData = {
    email: sanitizeInput(data.email),
    firstName: sanitizeInput(data.firstName),
    lastName: sanitizeInput(data.lastName),
    password: data.password // No sanitizar password
  };
  
  if (!sanitizedData.email || !validateEmail(sanitizedData.email)) {
    errors.push('Email válido es requerido');
  }
  
  if (!data.password || !validatePassword(data.password)) {
    errors.push('Contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos');
  }
  
  if (!sanitizedData.firstName || !validateUsername(sanitizedData.firstName)) {
    errors.push('Nombre debe tener entre 2 y 50 caracteres y solo contener letras, números y espacios');
  }
  
  if (!sanitizedData.lastName || !validateUsername(sanitizedData.lastName)) {
    errors.push('Apellido debe tener entre 2 y 50 caracteres y solo contener letras, números y espacios');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
};

/**
 * Register a new bar owner with basic bar creation
 */
export const registerBarOwner = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, nombre_del_bar } = req.body;

  // Validate input
  if (!email || !password || !nombre_del_bar) {
    throw new ValidationError('Email, contraseña y nombre del bar son requeridos');
  }

  // Sanitizar inputs
  const sanitizedEmail = sanitizeInput(email);
  const sanitizedBarName = sanitizeInput(nombre_del_bar);

  if (!validateEmail(sanitizedEmail)) {
    throw new ValidationError('Email válido es requerido');
  }

  if (!validatePassword(password)) {
    throw new ValidationError('Contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos');
  }

  if (!validateUsername(sanitizedBarName)) {
    throw new ValidationError('Nombre del bar debe tener entre 2 y 50 caracteres');
  }

  // Check if user already exists
  const existingUser = await UserModel.findByEmail(sanitizedEmail);
  if (existingUser) {
    throw new ConflictError('El usuario ya existe con este email');
  }

  // Create user with bar_owner role (mapped to bar_admin internally)
  const user = await UserModel.create({
    email: sanitizedEmail,
    password,
    firstName: 'Bar Owner', // Default first name
    lastName: 'Default', // Default last name
    role: 'bar_admin' // Internal mapping
  });

  // Create basic bar entry
  const bar = await BarModel.create({
    name: sanitizedBarName,
    address: 'Dirección por completar', // Placeholder
    city: 'Ciudad por completar', // Placeholder
    country: 'País por completar', // Placeholder
    ownerId: user.id
  });

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshTokenExpiresAt = new Date(Date.now() +
    (config.jwt.refreshExpiresIn === '7d' ? 7 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)
  );
  const refreshTokenData = await RefreshTokenModel.create(user.id, refreshTokenExpiresAt);

  logger.info('Bar owner registered successfully', { userId: user.id, email: user.email, barId: bar.id });

  sendSuccess(res, {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: 'bar_owner', // Return as bar_owner for API consistency
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive
    },
    bar: {
      id: bar.id,
      name: bar.name,
      address: bar.address,
      city: bar.city,
      country: bar.country
    },
    accessToken,
    refreshToken: refreshTokenData.token
  }, 'Propietario del bar registrado exitosamente', 201);
});

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

  // Usar datos sanitizados
  const { sanitizedData } = validation;

  // Check if user already exists
  const existingUser = await UserModel.findByEmail(email);
  if (existingUser) {
    throw new ConflictError('El usuario ya existe con este email');
  }

  // Create user con datos sanitizados
  const user = await UserModel.create({
    email: sanitizedData.email,
    password,
    firstName: sanitizedData.firstName,
    lastName: sanitizedData.lastName,
    role: (role === 'bar_owner' ? 'bar_admin' : role) as 'customer' | 'bar_admin' | 'super_admin'
  });

  // Generate tokens con configuración segura
  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshTokenExpiresAt = new Date(Date.now() + 
    (config.jwt.refreshExpiresIn === '7d' ? 7 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)
  );
  const refreshTokenData = await RefreshTokenModel.create(user.id, refreshTokenExpiresAt);

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

  // Sanitizar email
  const sanitizedEmail = sanitizeInput(email);
  
  if (!validateEmail(sanitizedEmail)) {
    throw new ValidationError('Email inválido');
  }

  // Find user with password
  const user = await UserModel.findByEmailWithPassword(sanitizedEmail);
  if (!user) {
    // Log intento de login fallido para seguridad
    logger.warn('Failed login attempt', { email: sanitizedEmail, ip: req.ip });
    throw new UnauthorizedError('Credenciales inválidas');
  }

  // Check if user is active
  if (!user.isActive) {
    logger.warn('Login attempt on inactive account', { userId: user.id, email: sanitizedEmail });
    throw new UnauthorizedError('Cuenta desactivada');
  }

  // Verify password
  const isValidPassword = await UserModel.verifyPassword(user.id, password);
  if (!isValidPassword) {
    logger.warn('Invalid password attempt', { userId: user.id, email: sanitizedEmail, ip: req.ip });
    throw new UnauthorizedError('Credenciales inválidas');
  }

  // Check if user has bar_owner role (bar_admin internally)
  if (user.role !== 'bar_admin') {
    logger.warn('Login attempt by non-bar-owner user', { userId: user.id, email: sanitizedEmail, role: user.role });
    throw new UnauthorizedError('Acceso denegado. Solo propietarios de bares pueden acceder.');
  }

  // Generate tokens con configuración segura
  const accessToken = generateAccessToken({ userId: user.id, role: user.role });
  const refreshTokenExpiresAt = new Date(Date.now() + 
    (config.jwt.refreshExpiresIn === '7d' ? 7 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)
  );
  const refreshTokenData = await RefreshTokenModel.create(user.id, refreshTokenExpiresAt);

  logger.info('User logged in successfully', { userId: user.id, email: user.email, ip: req.ip });

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
export const logout = asyncHandler(async (req: RequestWithUser, res: Response) => {
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
export const logoutAll = asyncHandler(async (req: RequestWithUser, res: Response) => {
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
export const getProfile = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('Usuario no autenticado');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new UnauthorizedError('Usuario no encontrado');
  }

  // If user is bar admin, get their bars
  let bars: Bar[] = [];
  if (user.role === 'bar_admin') {
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
export const changePassword = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('Usuario no autenticado');
  }

  if (!currentPassword || !newPassword) {
    throw new BadRequestError('Contraseña actual y nueva son requeridas');
  }

  // Validar nueva contraseña con criterios de seguridad
  if (!validatePassword(newPassword)) {
    throw new ValidationError('La nueva contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos');
  }

  // Verificar que la nueva contraseña sea diferente a la actual
  if (currentPassword === newPassword) {
    throw new BadRequestError('La nueva contraseña debe ser diferente a la actual');
  }

  // Verify current password
  const isValidPassword = await UserModel.verifyPassword(userId, currentPassword);
  if (!isValidPassword) {
    logger.warn('Invalid current password attempt during password change', { userId, ip: req.ip });
    throw new UnauthorizedError('Contraseña actual incorrecta');
  }

  // Update password
  const success = await UserModel.updatePassword(userId, newPassword);
  if (!success) {
    throw new BadRequestError('Error al actualizar contraseña');
  }

  // Revoke all refresh tokens to force re-login
  await RefreshTokenModel.revokeAllForUser(userId);

  logger.info('Password changed successfully', { userId, ip: req.ip });

  sendSuccess(res, null, 'Contraseña actualizada exitosamente. Por favor, inicia sesión nuevamente.');
});

/**
 * Get active sessions
 */
export const getActiveSessions = asyncHandler(async (req: RequestWithUser, res: Response) => {
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
export const revokeSession = asyncHandler(async (req: RequestWithUser, res: Response) => {
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

/**
 * Forgot password - send reset email
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email es requerido');
  }

  // Sanitizar email
  const sanitizedEmail = sanitizeInput(email);

  if (!validateEmail(sanitizedEmail)) {
    throw new ValidationError('Email inválido');
  }

  // Find user
  const user = await UserModel.findByEmail(sanitizedEmail);
  if (!user) {
    // Log intento de reset en email inexistente para monitoreo de seguridad
    logger.warn('Password reset attempt on non-existent email', { email: sanitizedEmail, ip: req.ip });
    // Don't reveal if email exists or not for security
    sendSuccess(res, null, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
    return;
  }

  // Verificar si la cuenta está activa
  if (!user.isActive) {
    logger.warn('Password reset attempt on inactive account', { userId: user.id, email: sanitizedEmail, ip: req.ip });
    sendSuccess(res, null, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
    return;
  }

  // Generate reset token (implement this in your UserModel)
  // const resetToken = await UserModel.generatePasswordResetToken(user.id);
  
  // Send email (implement email service)
  // await EmailService.sendPasswordResetEmail(user.email, resetToken);

  logger.info('Password reset requested', { userId: user.id, email: user.email, ip: req.ip });

  sendSuccess(res, null, 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
});

/**
 * Reset password with token
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new BadRequestError('Token y nueva contraseña son requeridos');
  }

  if (newPassword.length < 6) {
    throw new ValidationError('La contraseña debe tener al menos 6 caracteres');
  }

  try {
    // In a real implementation, verify the password reset token
    // For now, we'll use the refresh token verification as a placeholder
    const decoded = verifyRefreshToken(token) as any;
    const userId = decoded.userId;

    const success = await UserModel.updatePassword(userId, newPassword);
    if (!success) {
      throw new BadRequestError('Error al actualizar contraseña');
    }

    // Revoke all refresh tokens to force re-login
    await RefreshTokenModel.revokeAllForUser(userId);

    logger.info('Password reset successfully', { userId });

    sendSuccess(res, null, 'Contraseña restablecida exitosamente');
  } catch (error) {
    throw new BadRequestError('Token de restablecimiento inválido o expirado');
  }
});

/**
 * Resend email verification
 */
export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || !validateEmail(email)) {
    throw new BadRequestError('Email válido es requerido');
  }

  const user = await UserModel.findByEmail(email);
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
  }

  if (user.isEmailVerified) {
    throw new BadRequestError('El email ya está verificado');
  }

  // In a real implementation, send verification email
  logger.info('Email verification resent', { userId: user.id, email });

  sendSuccess(res, null, 'Email de verificación enviado');
});

/**
 * Authenticate middleware function
 */
export const authenticate = asyncHandler(async (req: RequestWithUser, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new UnauthorizedError('Token de acceso requerido');
  }

  try {
    const decoded = verifyRefreshToken(token) as any;
    const user = await UserModel.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Usuario no encontrado o inactivo');
    }

    req.user = {
      userId: user.id,
      role: user.role,
      email: user.email
    };

    next();
  } catch (error) {
    throw new UnauthorizedError('Token inválido');
  }
});