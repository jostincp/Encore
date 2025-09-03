import { ValidationResult } from '../types';

// Re-export ValidationResult for convenience
export { ValidationResult };

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): boolean => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Validate non-empty string
 */
export const validateNonEmptyString = (value: string): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * Validate phone number
 */
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[+]?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s-()]/g, ''));
};

/**
 * Validate URL
 */
export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate user registration data
 */
export const validateUserRegistration = (data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}): ValidationResult => {
  const errors: string[] = [];

  if (!validateEmail(data.email)) {
    errors.push('Email inválido');
  }

  if (!validatePassword(data.password)) {
    errors.push('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número');
  }

  if (!validateNonEmptyString(data.firstName)) {
    errors.push('Nombre requerido');
  }

  if (!validateNonEmptyString(data.lastName)) {
    errors.push('Apellido requerido');
  }

  if (data.role && !['admin', 'bar_owner', 'customer'].includes(data.role)) {
    errors.push('Rol inválido');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate bar creation data
 */
export const validateBarCreation = (data: {
  name: string;
  address: string;
  city: string;
  country: string;
  ownerId: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
}): ValidationResult => {
  const errors: string[] = [];

  if (!validateNonEmptyString(data.name)) {
    errors.push('Nombre del bar requerido');
  }

  if (!validateNonEmptyString(data.address)) {
    errors.push('Dirección requerida');
  }

  if (!validateNonEmptyString(data.city)) {
    errors.push('Ciudad requerida');
  }

  if (!validateNonEmptyString(data.country)) {
    errors.push('País requerido');
  }

  if (!validateNonEmptyString(data.ownerId)) {
    errors.push('ID del propietario requerido');
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.push('Teléfono inválido');
  }

  if (data.email && !validateEmail(data.email)) {
    errors.push('Email inválido');
  }

  if (data.websiteUrl && !validateUrl(data.websiteUrl)) {
    errors.push('URL del sitio web inválida');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (page?: number, limit?: number): ValidationResult => {
  const errors: string[] = [];

  if (page !== undefined && (page < 1 || !Number.isInteger(page))) {
    errors.push('Página debe ser un número entero mayor a 0');
  }

  if (limit !== undefined && (limit < 1 || limit > 100 || !Number.isInteger(limit))) {
    errors.push('Límite debe ser un número entero entre 1 y 100');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate UUID format
 */
export const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};