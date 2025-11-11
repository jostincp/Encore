import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { UserModel, User } from '../models/User';
import { RefreshTokenModel, RefreshToken } from '../models/RefreshToken';
import { BarModel, Bar } from '../models/Bar';
import { generateAccessToken, generateRefreshToken, verifyToken, verifyRefreshToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';
import { ValidationError, UnauthorizedError, ConflictError, NotFoundError, BadRequestError, ServiceUnavailableError } from '../utils/errors';
import { RequestWithUser } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  validateEmail,
  validatePassword,
  validateNonEmptyString as validateUsername,
  validateNonEmptyString,
  validatePhone
} from '../utils/validation';
import { config } from '../../../shared/config';
import { UserRole } from '../constants/roles';
import { getRedisService } from '../utils/redis';

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
 * Register a new guest user (temporary access)
 */
export const registerGuest = asyncHandler(async (req: Request, res: Response) => {
  // Create guest user with temporary ID
  const guestUser = await UserModel.create({
    email: `guest_${Date.now()}@encore.local`, // Temporary email
    password: 'guest_temp_password', // Not used for auth
    firstName: 'Guest',
    lastName: 'User',
    role: UserRole.GUEST
  });

  // Generate access token for guest (no refresh token for guests)
  const accessToken = generateAccessToken({
    userId: guestUser.id,
    email: guestUser.email,
    role: guestUser.role as UserRole
  });

  logger.info('Guest user registered', { userId: guestUser.id });

  sendSuccess(res, {
    user: {
      id: guestUser.id,
      role: guestUser.role,
      isGuest: true
    },
    accessToken
  }, 'Usuario invitado registrado exitosamente', 201);
});

/**
 * Migrar GUEST a USER (registro)
 */
export const registerUser = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { email, password, firstName, lastName } = req.body;
  const guestUserId = req.user?.userId;
  const guestRole = req.user?.role;

  // Validar que el usuario esté autenticado como invitado (GUEST)
  if (!guestUserId || guestRole !== UserRole.GUEST) {
    throw new UnauthorizedError('Solo usuarios invitados pueden registrarse como usuarios');
  }

  // Validate input
  if (!email || !password || !firstName || !lastName) {
    throw new ValidationError('Email, contraseña, nombre y apellido son requeridos');
  }

  // Sanitize inputs
  const sanitizedEmail = sanitizeInput(email);
  const sanitizedFirstName = sanitizeInput(firstName);
  const sanitizedLastName = sanitizeInput(lastName);

  if (!validateEmail(sanitizedEmail)) {
    throw new ValidationError('Email válido es requerido');
  }

  if (!validatePassword(password)) {
    throw new ValidationError('Contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos');
  }

  if (!validateUsername(sanitizedFirstName) || !validateUsername(sanitizedLastName)) {
    throw new ValidationError('Nombre y apellido deben tener entre 2 y 50 caracteres');
  }

  // Check if email is already taken by another user
  const existingUser = await UserModel.findByEmail(sanitizedEmail);
  if (existingUser && existingUser.id !== guestUserId) {
    throw new ConflictError('El email ya está registrado');
  }

  // Actualizar usuario invitado a usuario registrado (USER)
  const updatedUser = await UserModel.update(guestUserId, {
    email: sanitizedEmail,
    firstName: sanitizedFirstName,
    lastName: sanitizedLastName,
    role: UserRole.USER,
    isEmailVerified: false // Reset email verification for new email
  });

  if (!updatedUser) {
    throw new BadRequestError('Error al actualizar usuario');
  }

  // Update password separately
  const passwordUpdated = await UserModel.updatePassword(guestUserId, password);
  if (!passwordUpdated) {
    throw new BadRequestError('Error al actualizar contraseña');
  }

  if (!updatedUser) {
    throw new BadRequestError('Error al actualizar usuario');
  }

  // Generar nuevos tokens para usuario
  const accessToken = generateAccessToken({ userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role as UserRole });
  const refreshTokenExpiresAt = new Date(Date.now() +
    (config.jwt.refreshExpiresIn === '7d' ? 7 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)
  );
  const refreshTokenData = await RefreshTokenModel.create(updatedUser.id, refreshTokenExpiresAt);

  logger.info('Guest migrated to user', { userId: updatedUser.id, email: updatedUser.email });

  sendSuccess(res, {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isEmailVerified: updatedUser.isEmailVerified,
      isActive: updatedUser.isActive
    },
    accessToken,
    refreshToken: refreshTokenData.token
  }, 'Usuario registrado exitosamente', 201);
});

/**
 * Register a new bar owner with basic bar creation
 */
export const registerBarOwner = asyncHandler(async (req: Request, res: Response) => {
  const {
    email,
    password,
    firstName,
    lastName,
    barName,
    nombre_del_bar, // soporte retrocompatibilidad
    address,
    city,
    country,
    phone
  } = req.body;

  // Validación de campos requeridos
  if (!email || !password || !(barName || nombre_del_bar) || !firstName || !lastName || !address || !city || !country) {
    throw new ValidationError('Campos requeridos: nombre completo, email, nombre del bar, dirección, ciudad, país y contraseña');
  }

  // Sanitizar inputs
  const sanitizedEmail = sanitizeInput(email);
  const sanitizedFirstName = sanitizeInput(firstName);
  const sanitizedLastName = sanitizeInput(lastName);
  const sanitizedBarName = sanitizeInput(barName || nombre_del_bar);
  const sanitizedAddress = sanitizeInput(address);
  const sanitizedCity = sanitizeInput(city);
  const sanitizedCountry = sanitizeInput(country);

  if (!validateEmail(sanitizedEmail)) {
    throw new ValidationError('Email válido es requerido');
  }

  if (!validatePassword(password)) {
    throw new ValidationError('Contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos');
  }

  if (!validateUsername(sanitizedFirstName) || !validateUsername(sanitizedLastName)) {
    throw new ValidationError('Nombre y apellido deben tener entre 2 y 50 caracteres');
  }

  if (!validateUsername(sanitizedBarName)) {
    throw new ValidationError('Nombre del bar debe tener entre 2 y 50 caracteres');
  }

  // Validaciones de ubicación y teléfono
  if (!validateNonEmptyString(sanitizedAddress) || !validateNonEmptyString(sanitizedCity) || !validateNonEmptyString(sanitizedCountry)) {
    throw new ValidationError('Dirección, ciudad y país son requeridos');
  }

  if (phone && !validatePhone(phone)) {
    throw new ValidationError('Teléfono inválido');
  }

  // Check if user already exists
  const existingUser = await UserModel.findByEmail(sanitizedEmail);
  if (existingUser) {
    throw new ConflictError('El usuario ya existe con este email');
  }

  // Crear usuario con rol BAR_OWNER
  const user = await UserModel.create({
    email: sanitizedEmail,
    password,
    firstName: sanitizedFirstName,
    lastName: sanitizedLastName,
    phone,
    role: UserRole.BAR_OWNER
  });

  // Crear bar con datos completos
  const bar = await BarModel.create({
    name: sanitizedBarName,
    address: sanitizedAddress,
    city: sanitizedCity,
    country: sanitizedCountry,
    phone: phone || undefined,
    ownerId: user.id
  });

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role as UserRole });
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
      role: UserRole.BAR_OWNER,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive
    },
    bar: {
      id: bar.id,
      name: bar.name,
      address: bar.address,
      city: bar.city,
      country: bar.country,
      phone: bar.phone || undefined
    },
    accessToken,
    refreshToken: refreshTokenData.token
  }, 'Propietario del bar registrado exitosamente', 201);
});

/**
 * Create ADMIN user (private API, dev/test only)
 */
export const createAdmin = asyncHandler(async (req: Request, res: Response) => {
  const secretHeader = (req.headers['x-admin-create-secret'] || req.headers['X-Admin-Create-Secret']) as string | undefined;
  const ADMIN_SECRET = process.env.ADMIN_CREATE_SECRET;

  if (!ADMIN_SECRET || !secretHeader || secretHeader !== ADMIN_SECRET) {
    throw new UnauthorizedError('Acceso denegado');
  }

  const { email, password, firstName, lastName, phone } = req.body;

  if (!email || !password || !firstName || !lastName) {
    throw new ValidationError('Email, contraseña, nombre y apellido son requeridos');
  }

  const sanitizedEmail = sanitizeInput(email);
  const sanitizedFirstName = sanitizeInput(firstName);
  const sanitizedLastName = sanitizeInput(lastName);

  if (!validateEmail(sanitizedEmail)) {
    throw new ValidationError('Email inválido');
  }
  if (!validatePassword(password)) {
    throw new ValidationError('Contraseña insegura');
  }
  if (!validateUsername(sanitizedFirstName) || !validateUsername(sanitizedLastName)) {
    throw new ValidationError('Nombre y apellido inválidos');
  }
  if (phone && !validatePhone(phone)) {
    throw new ValidationError('Teléfono inválido');
  }

  const exists = await UserModel.findByEmail(sanitizedEmail);
  if (exists) {
    throw new ConflictError('El email ya existe');
  }

  const user = await UserModel.create({
    email: sanitizedEmail,
    password,
    firstName: sanitizedFirstName,
    lastName: sanitizedLastName,
    phone,
    role: UserRole.ADMIN
  });

  logger.info('Admin user created via private endpoint', { userId: user.id, email: user.email });

  sendSuccess(res, {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  }, 'Administrador creado exitosamente', 201);
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

  // Bloqueo incremental por intentos fallidos usando Redis
  const redis = getRedisService();
  const lockKey = `login:lock:${sanitizedEmail}`;
  const attemptsKey = `login:attempts:${sanitizedEmail}`;
  const stageKey = `login:lock_stage:${sanitizedEmail}`;

  const isLocked = await redis.exists(lockKey);
  if (isLocked) {
    const ttl = await redis.ttl(lockKey);
    const minutes = Math.max(1, Math.ceil(ttl / 60));
    logger.warn('Login blocked due to lockout', { email: sanitizedEmail, ip: req.ip, ttl_seconds: ttl });
    res.status(429).json({
      success: false,
      message: `Cuenta bloqueada por ${minutes} minutos debido a múltiples intentos fallidos`,
      error: 'Account locked'
    });
    return;
  }

  // Find user with password
  let user: (User & { password_hash: string }) | null = null;
  try {
    user = await UserModel.findByEmailWithPassword(sanitizedEmail);
  } catch (dbErr: any) {
    // Si la base de datos no está inicializada, devolver 503 con mensaje claro
    if (/Database not initialized/i.test(dbErr?.message) || /connect ECONNREFUSED/i.test(dbErr?.message)) {
      throw new ServiceUnavailableError('Servicio de autenticación no disponible. Intente nuevamente más tarde.');
    }
    throw dbErr;
  }
  if (!user) {
    // Intento fallido: incrementar contador y aplicar bloqueo si corresponde
    const attempts = await redis.incr(attemptsKey);
    logger.warn('Failed login attempt (user not found)', { email: sanitizedEmail, ip: req.ip, attempts });

    if (attempts % 3 === 0) {
      const currentStageStr = await redis.get(stageKey);
      const currentStage = Math.min(parseInt(currentStageStr || '0', 10) + 1, 3);
      const durations = [300, 900, 1800]; // 5m, 15m, 30m
      const duration = durations[currentStage - 1];
      await redis.set(lockKey, '1', duration);
      await redis.set(stageKey, String(currentStage));
      await redis.set(attemptsKey, '0');
      logger.warn('Account locked due to repeated failed attempts', { email: sanitizedEmail, stage: currentStage, duration_seconds: duration });
      res.status(429).json({
        success: false,
        message: `Cuenta bloqueada por ${duration / 60} minutos`,
        error: 'Account locked'
      });
      return;
    }

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
    const attempts = await redis.incr(attemptsKey);
    logger.warn('Invalid password attempt', { userId: user.id, email: sanitizedEmail, ip: req.ip, attempts });

    if (attempts % 3 === 0) {
      const currentStageStr = await redis.get(stageKey);
      const currentStage = Math.min(parseInt(currentStageStr || '0', 10) + 1, 3);
      const durations = [300, 900, 1800];
      const duration = durations[currentStage - 1];
      await redis.set(lockKey, '1', duration);
      await redis.set(stageKey, String(currentStage));
      await redis.set(attemptsKey, '0');
      logger.warn('Account locked due to repeated invalid password attempts', { userId: user.id, email: sanitizedEmail, stage: currentStage, duration_seconds: duration });
      res.status(429).json({
        success: false,
        message: `Cuenta bloqueada por ${duration / 60} minutos`,
        error: 'Account locked'
      });
      return;
    }

    throw new UnauthorizedError('Credenciales inválidas');
  }

  // Check if user has bar_owner role
  // Permitir ADMIN y BAR_OWNER
  if (![UserRole.BAR_OWNER, UserRole.ADMIN].includes(user.role as UserRole)) {
    logger.warn('Login attempt by unauthorized role', { userId: user.id, email: sanitizedEmail, role: user.role });
    throw new UnauthorizedError('Acceso denegado. Solo propietarios de bares o administradores pueden acceder.');
  }

  // Generate tokens con configuración segura
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role as UserRole });
  const refreshTokenExpiresAt = new Date(Date.now() + 
    (config.jwt.refreshExpiresIn === '7d' ? 7 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)
  );
  const refreshTokenData = await RefreshTokenModel.create(user.id, refreshTokenExpiresAt);

  logger.info('User logged in successfully', { userId: user.id, email: user.email, ip: req.ip });

  // Resetear intentos y stage tras login exitoso
  try {
    await redis.del(attemptsKey);
    await redis.del(stageKey);
    await redis.del(lockKey);
  } catch (e) {
    logger.warn('Failed to reset login attempt counters', { email: sanitizedEmail });
  }

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
    token: accessToken,
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
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role as UserRole });

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

  // If user is bar owner, get their bars
  let bars: Bar[] = [];
  if (user.role === UserRole.BAR_OWNER) {
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
    const decoded = verifyToken(token) as any;
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
    // For now, we'll use the access token verification as a placeholder
    const decoded = verifyToken(token) as any;
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

// Middleware authenticate is now imported from ../utils/jwt