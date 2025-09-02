import { ValidationResult, ValidationError } from '../types';

// Función base para validación
export const createValidationResult = (isValid: boolean, errors: ValidationError[] = []): ValidationResult => {
  return { isValid, errors };
};

// Validadores básicos
export const isEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isStrongPassword = (password: string): boolean => {
  // Al menos 8 caracteres, una mayúscula, una minúscula, un número
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const isPositiveNumber = (value: number): boolean => {
  return typeof value === 'number' && value > 0;
};

export const isNonEmptyString = (value: string): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

// Validadores específicos del dominio
export const validateUserRegistration = (userData: any): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!isNonEmptyString(userData.email)) {
    errors.push({ field: 'email', message: 'Email es requerido' });
  } else if (!isEmail(userData.email)) {
    errors.push({ field: 'email', message: 'Email no es válido' });
  }

  if (!isNonEmptyString(userData.password)) {
    errors.push({ field: 'password', message: 'Password es requerido' });
  } else if (!isStrongPassword(userData.password)) {
    errors.push({ field: 'password', message: 'Password debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' });
  }

  if (!['admin', 'customer'].includes(userData.role)) {
    errors.push({ field: 'role', message: 'Role debe ser admin o customer' });
  }

  return createValidationResult(errors.length === 0, errors);
};

export const validateBarCreation = (barData: any): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!isNonEmptyString(barData.name)) {
    errors.push({ field: 'name', message: 'Nombre del bar es requerido' });
  }

  if (!isNonEmptyString(barData.address)) {
    errors.push({ field: 'address', message: 'Dirección es requerida' });
  }

  if (!isValidUUID(barData.ownerId)) {
    errors.push({ field: 'ownerId', message: 'ID del propietario no es válido' });
  }

  if (barData.settings) {
    if (!isPositiveNumber(barData.settings.pointsPerEuro)) {
      errors.push({ field: 'settings.pointsPerEuro', message: 'Puntos por euro debe ser un número positivo' });
    }

    if (!isPositiveNumber(barData.settings.songCostPoints)) {
      errors.push({ field: 'settings.songCostPoints', message: 'Costo de canción en puntos debe ser un número positivo' });
    }

    if (!['youtube', 'spotify'].includes(barData.settings.musicProvider)) {
      errors.push({ field: 'settings.musicProvider', message: 'Proveedor de música debe ser youtube o spotify' });
    }
  }

  return createValidationResult(errors.length === 0, errors);
};

export const validateSongRequest = (requestData: any): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!isValidUUID(requestData.barId)) {
    errors.push({ field: 'barId', message: 'ID del bar no es válido' });
  }

  if (!isValidUUID(requestData.tableId)) {
    errors.push({ field: 'tableId', message: 'ID de la mesa no es válido' });
  }

  if (!isValidUUID(requestData.songId)) {
    errors.push({ field: 'songId', message: 'ID de la canción no es válido' });
  }

  if (!isPositiveNumber(requestData.pointsSpent)) {
    errors.push({ field: 'pointsSpent', message: 'Puntos gastados debe ser un número positivo' });
  }

  return createValidationResult(errors.length === 0, errors);
};

export const validateMenuItem = (itemData: any): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!isNonEmptyString(itemData.name)) {
    errors.push({ field: 'name', message: 'Nombre del producto es requerido' });
  }

  if (!isPositiveNumber(itemData.price)) {
    errors.push({ field: 'price', message: 'Precio debe ser un número positivo' });
  }

  if (!isPositiveNumber(itemData.pointsReward)) {
    errors.push({ field: 'pointsReward', message: 'Recompensa en puntos debe ser un número positivo' });
  }

  if (!isNonEmptyString(itemData.category)) {
    errors.push({ field: 'category', message: 'Categoría es requerida' });
  }

  if (!isValidUUID(itemData.barId)) {
    errors.push({ field: 'barId', message: 'ID del bar no es válido' });
  }

  return createValidationResult(errors.length === 0, errors);
};

// Sanitización de datos
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>"'&]/g, '');
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

// Validación de parámetros de consulta
export const validatePaginationParams = (query: any): { page: number; limit: number; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];
  let page = 1;
  let limit = 10;

  if (query.page) {
    const parsedPage = parseInt(query.page);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push({ field: 'page', message: 'Page debe ser un número positivo' });
    } else {
      page = parsedPage;
    }
  }

  if (query.limit) {
    const parsedLimit = parseInt(query.limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.push({ field: 'limit', message: 'Limit debe ser un número entre 1 y 100' });
    } else {
      limit = parsedLimit;
    }
  }

  return { page, limit, errors };
};