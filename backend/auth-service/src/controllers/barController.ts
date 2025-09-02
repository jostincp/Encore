import { Request, Response } from 'express';
import { 
  asyncHandler, 
  sendSuccess, 
  sendError, 
  ValidationError, 
  NotFoundError, 
  ForbiddenError,
  BadRequestError
} from '../../../shared/utils/errors';
import { AuthenticatedRequest } from '../../../shared/utils/jwt';
import { validateBarCreation, validateNonEmptyString } from '../../../shared/utils/validation';
import { BarModel } from '../models/Bar';
import { UserModel } from '../models/User';
import { logger } from '../../../shared/utils/logger';
import { Bar, BarSettings } from '../../../shared/types';

/**
 * Create a new bar (bar_owner or admin only)
 */
export const createBar = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  const { name, address, phone, description, ownerId } = req.body;

  if (!userId) {
    throw new BadRequestError('Usuario no autenticado');
  }

  // Determine the actual owner ID
  let actualOwnerId = userId;
  
  // If admin is creating a bar for someone else
  if (userRole === 'admin' && ownerId) {
    const owner = await UserModel.findById(ownerId);
    if (!owner) {
      throw new NotFoundError('Propietario no encontrado');
    }
    if (owner.role !== 'bar_owner') {
      throw new ValidationError('El propietario debe tener rol de bar_owner');
    }
    actualOwnerId = ownerId;
  } else if (userRole !== 'bar_owner' && userRole !== 'admin') {
    throw new ForbiddenError('Solo los propietarios de bares y administradores pueden crear bares');
  }

  // Validate input
  const validation = validateBarCreation({ name, address, phone, description });
  if (!validation.isValid) {
    throw new ValidationError('Datos del bar inválidos', validation.errors);
  }

  const bar = await BarModel.create({
    name,
    address,
    phone,
    description,
    ownerId: actualOwnerId
  });

  logger.info('Bar created', { barId: bar.id, ownerId: actualOwnerId, createdBy: userId });

  sendSuccess(res, { bar }, 'Bar creado exitosamente', 201);
});

/**
 * Get all bars
 */
export const getBars = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const city = req.query.city as string;

  const filters: any = {};
  if (search) filters.search = search;
  if (isActive !== undefined) filters.isActive = isActive;
  if (city) filters.city = city;

  const result = await BarModel.findMany({
    page,
    limit,
    filters
  });

  sendSuccess(res, {
    bars: result.bars,
    pagination: result.pagination
  }, 'Bares obtenidos exitosamente');
});

/**
 * Get bar by ID
 */
export const getBarById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const includeSettings = req.query.includeSettings === 'true';

  if (!id) {
    throw new BadRequestError('ID del bar requerido');
  }

  let bar;
  if (includeSettings) {
    bar = await BarModel.findByIdWithSettings(id);
  } else {
    bar = await BarModel.findById(id);
  }

  if (!bar) {
    throw new NotFoundError('Bar no encontrado');
  }

  sendSuccess(res, { bar }, 'Bar obtenido exitosamente');
});

/**
 * Update bar
 */
export const updateBar = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  const { name, address, phone, description } = req.body;

  if (!id) {
    throw new BadRequestError('ID del bar requerido');
  }

  if (!userId) {
    throw new BadRequestError('Usuario no autenticado');
  }

  // Check if user can update this bar
  if (userRole !== 'admin') {
    const isOwner = await BarModel.isOwner(id, userId);
    if (!isOwner) {
      throw new ForbiddenError('Solo el propietario o un administrador pueden actualizar este bar');
    }
  }

  // Validate input
  const updateData: any = {};
  
  if (name !== undefined) {
    if (!validateNonEmptyString(name)) {
      throw new ValidationError('Nombre del bar inválido');
    }
    updateData.name = name;
  }

  if (address !== undefined) {
    if (!validateNonEmptyString(address)) {
      throw new ValidationError('Dirección inválida');
    }
    updateData.address = address;
  }

  if (phone !== undefined) {
    if (!validateNonEmptyString(phone)) {
      throw new ValidationError('Teléfono inválido');
    }
    updateData.phone = phone;
  }

  if (description !== undefined) {
    updateData.description = description;
  }

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestError('No hay datos para actualizar');
  }

  const updatedBar = await BarModel.update(id, updateData);
  if (!updatedBar) {
    throw new NotFoundError('Bar no encontrado');
  }

  logger.info('Bar updated', { barId: id, updatedBy: userId });

  sendSuccess(res, { bar: updatedBar }, 'Bar actualizado exitosamente');
});

/**
 * Get bars owned by user
 */
export const getMyBars = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!userId) {
    throw new BadRequestError('Usuario no autenticado');
  }

  if (userRole !== 'bar_owner' && userRole !== 'admin') {
    throw new ForbiddenError('Acceso denegado');
  }

  const bars = await BarModel.findByOwnerId(userId);

  sendSuccess(res, { bars }, 'Bares obtenidos exitosamente');
});

/**
 * Deactivate bar
 */
export const deactivateBar = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID del bar requerido');
  }

  if (!userId) {
    throw new BadRequestError('Usuario no autenticado');
  }

  // Check if user can deactivate this bar
  if (userRole !== 'admin') {
    const isOwner = await BarModel.isOwner(id, userId);
    if (!isOwner) {
      throw new ForbiddenError('Solo el propietario o un administrador pueden desactivar este bar');
    }
  }

  const success = await BarModel.deactivate(id);
  if (!success) {
    throw new NotFoundError('Bar no encontrado');
  }

  logger.info('Bar deactivated', { barId: id, deactivatedBy: userId });

  sendSuccess(res, null, 'Bar desactivado exitosamente');
});

/**
 * Activate bar (admin only)
 */
export const activateBar = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID del bar requerido');
  }

  if (userRole !== 'admin') {
    throw new ForbiddenError('Solo los administradores pueden activar bares');
  }

  const updatedBar = await BarModel.update(id, { isActive: true });
  if (!updatedBar) {
    throw new NotFoundError('Bar no encontrado');
  }

  logger.info('Bar activated', { barId: id, activatedBy: userId });

  sendSuccess(res, { bar: updatedBar }, 'Bar activado exitosamente');
});

/**
 * Delete bar (admin only)
 */
export const deleteBar = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID del bar requerido');
  }

  if (userRole !== 'admin') {
    throw new ForbiddenError('Solo los administradores pueden eliminar bares');
  }

  const success = await BarModel.delete(id);
  if (!success) {
    throw new NotFoundError('Bar no encontrado');
  }

  logger.info('Bar deleted', { barId: id, deletedBy: userId });

  sendSuccess(res, null, 'Bar eliminado exitosamente');
});

/**
 * Get bar settings
 */
export const getBarSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!id) {
    throw new BadRequestError('ID del bar requerido');
  }

  if (!userId) {
    throw new BadRequestError('Usuario no autenticado');
  }

  // Check if user can access bar settings
  if (userRole !== 'admin') {
    const isOwner = await BarModel.isOwner(id, userId);
    if (!isOwner) {
      throw new ForbiddenError('Solo el propietario o un administrador pueden ver la configuración del bar');
    }
  }

  const settings = await BarModel.getSettings(id);
  if (!settings) {
    throw new NotFoundError('Configuración del bar no encontrada');
  }

  sendSuccess(res, { settings }, 'Configuración del bar obtenida exitosamente');
});

/**
 * Update bar settings
 */
export const updateBarSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  const settingsData = req.body;

  if (!id) {
    throw new BadRequestError('ID del bar requerido');
  }

  if (!userId) {
    throw new BadRequestError('Usuario no autenticado');
  }

  // Check if user can update bar settings
  if (userRole !== 'admin') {
    const isOwner = await BarModel.isOwner(id, userId);
    if (!isOwner) {
      throw new ForbiddenError('Solo el propietario o un administrador pueden actualizar la configuración del bar');
    }
  }

  // Validate settings data
  const allowedSettings = [
    'maxSongsPerUser', 'songRequestCooldown', 'priorityPlayCost',
    'autoApproveRequests', 'allowExplicitContent', 'maxQueueSize',
    'pointsPerVisit', 'pointsPerPurchase', 'enableLoyaltyProgram',
    'openTime', 'closeTime', 'timezone'
  ];

  const updateData: any = {};
  for (const [key, value] of Object.entries(settingsData)) {
    if (allowedSettings.includes(key)) {
      updateData[key] = value;
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestError('No hay configuraciones válidas para actualizar');
  }

  const updatedSettings = await BarModel.updateSettings(id, updateData);
  if (!updatedSettings) {
    throw new NotFoundError('Bar no encontrado');
  }

  logger.info('Bar settings updated', { barId: id, updatedBy: userId });

  sendSuccess(res, { settings: updatedSettings }, 'Configuración del bar actualizada exitosamente');
});

/**
 * Get bar statistics (owner or admin only)
 */
export const getBarStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!userId) {
    throw new BadRequestError('Usuario no autenticado');
  }

  let filters: any = {};
  
  // If not admin, only show stats for owned bars
  if (userRole !== 'admin') {
    if (userRole !== 'bar_owner') {
      throw new ForbiddenError('Acceso denegado');
    }
    filters.ownerId = userId;
  }

  const activeResult = await BarModel.findMany({ 
    page: 1, 
    limit: 1, 
    filters: { ...filters, isActive: true } 
  });
  
  const inactiveResult = await BarModel.findMany({ 
    page: 1, 
    limit: 1, 
    filters: { ...filters, isActive: false } 
  });

  const totalResult = await BarModel.findMany({ 
    page: 1, 
    limit: 1, 
    filters 
  });

  sendSuccess(res, {
    stats: {
      total: totalResult.pagination.total,
      active: activeResult.pagination.total,
      inactive: inactiveResult.pagination.total
    }
  }, 'Estadísticas de bares obtenidas exitosamente');
});