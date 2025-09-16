import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserModel, User } from '../models/User';
import { sendSuccess, sendError } from '../utils/response';
import { ValidationError, UnauthorizedError, NotFoundError, ConflictError, ForbiddenError, BadRequestError } from '../utils/errors';
import { RequestWithUser } from '../types';
import { asyncHandler } from '../middleware/asyncHandler';
import { logger } from '../utils/logger';

// Validation functions
const validateNonEmptyString = (str: string): boolean => {
  return typeof str === 'string' && str.trim().length > 0;
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Get all users (admin only)
 */
export const getUsers = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const userRole = req.user?.role;
  
  if (userRole !== 'super_admin') {
    throw new ForbiddenError('Acceso denegado');
  }

  // Parse pagination parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;

  // Parse filters
  const role = req.query.role as string;
  const isActive = req.query.isActive ? req.query.isActive === 'true' : undefined;
  const search = req.query.search as string;

  const result = await UserModel.findMany({
    limit,
    offset,
    role,
    isActive,
    search
  });

  sendSuccess(res, {
    users: result.users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })),
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit)
    }
  }, 'Usuarios obtenidos exitosamente');
});

/**
 * Get user by ID
 */
export const getUserById = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?.userId;
  const currentUserRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID de usuario requerido');
  }

  // Users can only view their own profile unless they are admin
  if (currentUserRole !== 'super_admin' && currentUserId !== id) {
    throw new ForbiddenError('Acceso denegado');
  }

  const user = await UserModel.findById(id);
  if (!user) {
    throw new NotFoundError('Usuario no encontrado');
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
    }
  }, 'Usuario obtenido exitosamente');
});

/**
 * Update user profile
 */
export const updateUser = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?.userId;
  const currentUserRole = req.user?.role;
  const { firstName, lastName, email } = req.body;

  if (!id) {
    throw new BadRequestError('ID de usuario requerido');
  }

  // Users can only update their own profile unless they are admin
  if (currentUserRole !== 'super_admin' && currentUserId !== id) {
    throw new ForbiddenError('Acceso denegado');
  }

  // Validate input
  const updateData: any = {};
  
  if (firstName !== undefined) {
    if (!validateNonEmptyString(firstName)) {
      throw new ValidationError('Nombre inválido');
    }
    updateData.firstName = firstName;
  }

  if (lastName !== undefined) {
    if (!validateNonEmptyString(lastName)) {
      throw new ValidationError('Apellido inválido');
    }
    updateData.lastName = lastName;
  }

  if (email !== undefined) {
    if (!validateEmail(email)) {
      throw new ValidationError('Email inválido');
    }
    
    // Check if email is already taken by another user
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser && existingUser.id !== id) {
      throw new ValidationError('El email ya está en uso');
    }
    
    updateData.email = email;
    updateData.isEmailVerified = false; // Reset email verification if email changes
  }

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestError('No hay datos para actualizar');
  }

  const updatedUser = await UserModel.update(id, updateData);
  if (!updatedUser) {
    throw new NotFoundError('Usuario no encontrado');
  }

  logger.info('User updated', { userId: id, updatedBy: currentUserId });

  sendSuccess(res, {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isEmailVerified: updatedUser.isEmailVerified,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    }
  }, 'Usuario actualizado exitosamente');
});

/**
 * Deactivate user (admin only)
 */
export const deactivateUser = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?.userId;
  const currentUserRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID de usuario requerido');
  }

  if (currentUserRole !== 'super_admin') {
    throw new ForbiddenError('Acceso denegado');
  }

  // Prevent admin from deactivating themselves
  if (currentUserId === id) {
    throw new BadRequestError('No puedes desactivar tu propia cuenta');
  }

  const success = await UserModel.deactivate(id);
  if (!success) {
    throw new NotFoundError('Usuario no encontrado');
  }

  logger.info('User deactivated', { userId: id, deactivatedBy: currentUserId });

  sendSuccess(res, null, 'Usuario desactivado exitosamente');
});

/**
 * Activate user (admin only)
 */
export const activateUser = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?.userId;
  const currentUserRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID de usuario requerido');
  }

  if (currentUserRole !== 'super_admin') {
    throw new ForbiddenError('Acceso denegado');
  }

  const updatedUser = await UserModel.update(id, { isActive: true });
  if (!updatedUser) {
    throw new NotFoundError('Usuario no encontrado');
  }

  logger.info('User activated', { userId: id, activatedBy: currentUserId });

  sendSuccess(res, {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isEmailVerified: updatedUser.isEmailVerified,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    }
  }, 'Usuario activado exitosamente');
});

/**
 * Delete user (admin only)
 */
export const deleteUser = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?.userId;
  const currentUserRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID de usuario requerido');
  }

  if (currentUserRole !== 'super_admin') {
    throw new ForbiddenError('Acceso denegado');
  }

  // Prevent admin from deleting themselves
  if (currentUserId === id) {
    throw new BadRequestError('No puedes eliminar tu propia cuenta');
  }

  const success = await UserModel.delete(id);
  if (!success) {
    throw new NotFoundError('Usuario no encontrado');
  }

  logger.info('User deleted', { userId: id, deletedBy: currentUserId });

  sendSuccess(res, null, 'Usuario eliminado exitosamente');
});

/**
 * Update user role (admin only)
 */
export const updateUserRole = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;
  const currentUserId = req.user?.userId;
  const currentUserRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID de usuario requerido');
  }

  if (currentUserRole !== 'super_admin') {
    throw new ForbiddenError('Acceso denegado');
  }

  if (!role || !['customer', 'bar_owner', 'super_admin'].includes(role)) {
    throw new ValidationError('Rol inválido');
  }

  // Prevent admin from changing their own role
  if (currentUserId === id) {
    throw new BadRequestError('No puedes cambiar tu propio rol');
  }

  const updatedUser = await UserModel.update(id, { role });
  if (!updatedUser) {
    throw new NotFoundError('Usuario no encontrado');
  }

  logger.info('User role updated', { userId: id, newRole: role, updatedBy: currentUserId });

  sendSuccess(res, {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isEmailVerified: updatedUser.isEmailVerified,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    }
  }, 'Rol de usuario actualizado exitosamente');
});

/**
 * Get user statistics (admin only)
 */
export const getUserStats = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const currentUserRole = req.user?.role;

  if (currentUserRole !== 'super_admin') {
    throw new ForbiddenError('Acceso denegado');
  }

  // Get user counts by role
  const customerResult = await UserModel.findMany({ 
    limit: 1, 
    offset: 0,
    role: 'customer'
  });
  
  const barOwnerResult = await UserModel.findMany({ 
    limit: 1, 
    offset: 0,
    role: 'bar_owner'
  });
  
  const adminResult = await UserModel.findMany({ 
    limit: 1, 
    offset: 0,
    role: 'super_admin'
  });

  const activeResult = await UserModel.findMany({ 
    limit: 1, 
    offset: 0,
    isActive: true
  });

  const inactiveResult = await UserModel.findMany({ 
    limit: 1, 
    offset: 0,
    isActive: false
  });

  sendSuccess(res, {
    stats: {
      total: customerResult.total + barOwnerResult.total + adminResult.total,
      byRole: {
        customers: customerResult.total,
        barOwners: barOwnerResult.total,
        admins: adminResult.total
      },
      byStatus: {
        active: activeResult.total,
        inactive: inactiveResult.total
      }
    }
  }, 'Estadísticas de usuarios obtenidas exitosamente');
});