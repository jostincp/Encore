import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errors';
import { UserRole } from '../types/index';

// ==============================================
// ESQUEMAS DE VALIDACIÓN CON ZOD
// ==============================================

// Esquema base para sanitización de strings
const sanitizedString = (min: number = 1, max: number = 255) =>
  z.string()
    .min(min, `Debe tener al menos ${min} caracteres`)
    .max(max, `No puede exceder ${max} caracteres`)
    .transform((val) => val.trim().replace(/[<>]/g, ''));

// Esquema para email
export const emailSchema = z.string()
  .email('Email inválido')
  .transform((val) => val.toLowerCase().trim())
  .refine((val) => val.length <= 254, 'Email demasiado largo');

// Esquema para contraseña segura
export const passwordSchema = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede exceder 128 caracteres')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'La contraseña debe incluir mayúsculas, minúsculas, números y símbolos');

// Esquema para nombre/apellido
export const nameSchema = z.string()
  .min(2, 'Debe tener al menos 2 caracteres')
  .max(50, 'No puede exceder 50 caracteres')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Solo se permiten letras, espacios, guiones y apóstrofes')
  .transform((val) => val.trim().replace(/[<>]/g, ''));

// Esquema para nombre de usuario
export const usernameSchema = z.string()
  .min(3, 'Debe tener al menos 3 caracteres')
  .max(30, 'No puede exceder 30 caracteres')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Solo se permiten letras, números, guiones y guiones bajos')
  .transform((val) => val.trim().replace(/[<>]/g, ''));

// Esquema para texto general
export const textSchema = (maxLength: number = 500) =>
  sanitizedString(1, maxLength);

// Esquema para ID (UUID o MongoDB ObjectId)
export const idSchema = z.string()
  .regex(/^[a-fA-F0-9]{24}$|^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'ID inválido');

// Esquema para token JWT
export const tokenSchema = z.string()
  .min(10, 'Token inválido')
  .max(1000, 'Token demasiado largo');

// Esquema para URL
export const urlSchema = z.string()
  .url('URL inválida')
  .refine((val) => val.startsWith('https://'), 'Solo se permiten URLs HTTPS');

// ==============================================
// ESQUEMAS DE AUTENTICACIÓN
// ==============================================

export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    // Evitar z.nativeEnum por issues de runtime con Zod cuando el enum
    // se resuelve como undefined en ciertos loaders. Usamos valores explícitos.
    role: z.enum(['guest', 'user', 'staff', 'bar_owner', 'admin']).optional().default('user')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Contraseña requerida')
  })
});

// Registro de propietario de bar (Bar Owner)
export const registerBarOwnerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    barName: sanitizedString(2, 100),
    address: sanitizedString(5, 255),
    city: sanitizedString(2, 100),
    country: sanitizedString(2, 100),
    phone: z
      .string()
      .min(7, 'Teléfono demasiado corto')
      .max(20, 'Teléfono demasiado largo')
      .regex(/^[+]?[-() 0-9]{7,20}$/,
        'Formato de teléfono inválido')
      .optional()
  })
});

// Creación privada de ADMIN (solo API)
export const createAdminSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    phone: z
      .string()
      .min(7, 'Teléfono demasiado corto')
      .max(20, 'Teléfono demasiado largo')
      .regex(/^[+]?[-() 0-9]{7,20}$/,
        'Formato de teléfono inválido')
      .optional()
  })
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: tokenSchema
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Contraseña actual requerida'),
    newPassword: passwordSchema
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: tokenSchema,
    newPassword: passwordSchema
  })
});

export const verifyEmailSchema = z.object({
  params: z.object({
    token: tokenSchema
  })
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: tokenSchema.optional()
  })
});

// ==============================================
// ESQUEMAS DE MÚSICA
// ==============================================

export const searchSongsSchema = z.object({
  query: z.object({
    q: sanitizedString(1, 100),
    limit: z.string().optional().transform((val) => val ? parseInt(val) : 25).refine((val) => val >= 1 && val <= 100, 'Límite debe estar entre 1 y 100'),
    offset: z.string().optional().transform((val) => val ? parseInt(val) : 0).refine((val) => val >= 0, 'Offset debe ser positivo')
  })
});

export const createSongSchema = z.object({
  body: z.object({
    title: sanitizedString(1, 200),
    artist: sanitizedString(1, 200),
    album: sanitizedString(1, 200).optional(),
    duration: z.number().int().min(10).max(1800), // 10 segundos a 30 minutos
    genre: sanitizedString(1, 50).optional(),
    url: urlSchema,
    thumbnailUrl: urlSchema.optional(),
    externalId: sanitizedString(1, 100).optional()
  })
});

export const updateSongSchema = z.object({
  params: z.object({
    id: idSchema
  }),
  body: z.object({
    title: sanitizedString(1, 200).optional(),
    artist: sanitizedString(1, 200).optional(),
    album: sanitizedString(1, 200).optional(),
    duration: z.number().int().min(10).max(1800).optional(),
    genre: sanitizedString(1, 50).optional(),
    url: urlSchema.optional(),
    thumbnailUrl: urlSchema.optional(),
    externalId: sanitizedString(1, 100).optional()
  })
});

// ==============================================
// ESQUEMAS DE COLA
// ==============================================

export const addToQueueSchema = z.object({
  body: z.object({
    songId: idSchema,
    priority: z.number().int().min(1).max(10).optional().default(5)
  })
});

export const updateQueueItemSchema = z.object({
  params: z.object({
    id: idSchema
  }),
  body: z.object({
    priority: z.number().int().min(1).max(10).optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'playing', 'played']).optional()
  })
});

export const queueFiltersSchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'playing', 'played']).optional(),
    limit: z.string().optional().transform((val) => val ? parseInt(val) : 50).refine((val) => val >= 1 && val <= 200, 'Límite debe estar entre 1 y 200'),
    offset: z.string().optional().transform((val) => val ? parseInt(val) : 0).refine((val) => val >= 0, 'Offset debe ser positivo')
  })
});

// ==============================================
// ESQUEMAS DE PUNTOS
// ==============================================

export const earnPointsSchema = z.object({
  body: z.object({
    amount: z.number().positive().max(10000),
    description: textSchema(200),
    transactionType: z.enum(['earned', 'spent', 'bonus', 'refund']).default('earned')
  })
});

export const redeemPointsSchema = z.object({
  body: z.object({
    points: z.number().int().positive().max(10000),
    description: textSchema(200)
  })
});

export const pointsTransactionSchema = z.object({
  query: z.object({
    type: z.enum(['earned', 'spent', 'bonus', 'refund']).optional(),
    limit: z.string().optional().transform((val) => val ? parseInt(val) : 20).refine((val) => val >= 1 && val <= 100, 'Límite debe estar entre 1 y 100'),
    offset: z.string().optional().transform((val) => val ? parseInt(val) : 0).refine((val) => val >= 0, 'Offset debe ser positivo')
  })
});

// ==============================================
// ESQUEMAS DE MENÚ
// ==============================================

export const createMenuItemSchema = z.object({
  body: z.object({
    name: sanitizedString(1, 100),
    description: textSchema(500).optional(),
    price: z.number().positive().max(9999.99),
    categoryId: idSchema,
    imageUrl: urlSchema.optional(),
    isAvailable: z.boolean().optional().default(true),
    allergens: z.array(sanitizedString(1, 50)).max(10).optional(),
    preparationTime: z.number().int().min(1).max(120).optional() // minutos
  })
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    id: idSchema
  }),
  body: z.object({
    name: sanitizedString(1, 100).optional(),
    description: textSchema(500).optional(),
    price: z.number().positive().max(9999.99).optional(),
    categoryId: idSchema.optional(),
    imageUrl: urlSchema.optional(),
    isAvailable: z.boolean().optional(),
    allergens: z.array(sanitizedString(1, 50)).max(10).optional(),
    preparationTime: z.number().int().min(1).max(120).optional()
  })
});

export const createCategorySchema = z.object({
  body: z.object({
    name: sanitizedString(1, 50),
    description: textSchema(200).optional(),
    imageUrl: urlSchema.optional(),
    displayOrder: z.number().int().min(0).max(100).optional().default(0)
  })
});

// ==============================================
// MIDDLEWARE DE VALIDACIÓN
// ==============================================

export const validateRequest = (schema: z.ZodSchema<any>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validar el cuerpo de la petición (compatibilidad con esquemas que envuelven en { body })
      const validatedData = await schema.parseAsync({ body: req.body });

      // Asignar datos validados y sanitizados de vuelta a req
      // Si el esquema utiliza wrapper { body }, extraerlo; de lo contrario, asignar completo
      req.body = (validatedData as any).body ?? validatedData;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map((err: z.ZodIssue) => ({
          name: 'ValidationError',
          field: err.path.join('.'),
          message: err.message
        }));

        next(new ValidationError('Errores de validación', validationErrors));
      } else {
        next(error);
      }
    }
  };

// Middleware específico para query parameters
export const validateQuery = (schema: z.ZodSchema<any>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Compatibilidad con esquemas que envuelven en { query }
      const validatedData = await schema.parseAsync({ query: req.query });
      req.query = (validatedData as any).query ?? validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map((err: z.ZodIssue) => ({
          name: 'ValidationError',
          field: err.path.join('.'),
          message: err.message
        }));

        next(new ValidationError('Errores de validación en query', validationErrors));
      } else {
        next(error);
      }
    }
  };

// Middleware específico para route parameters
export const validateParams = (schema: z.ZodSchema<any>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Compatibilidad con esquemas que envuelven en { params }
      const validatedData = await schema.parseAsync({ params: req.params });
      req.params = (validatedData as any).params ?? validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map((err: z.ZodIssue) => ({
          name: 'ValidationError',
          field: err.path.join('.'),
          message: err.message
        }));

        next(new ValidationError('Errores de validación en parámetros', validationErrors));
      } else {
        next(error);
      }
    }
  };

// ==============================================
// UTILIDADES DE VALIDACIÓN
// ==============================================

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const validateEmail = (email: string): boolean => {
  return emailSchema.safeParse(email).success;
};

export const validatePassword = (password: string): boolean => {
  return passwordSchema.safeParse(password).success;
};

export const validateId = (id: string): boolean => {
  return idSchema.safeParse(id).success;
};

// Función para validar archivos (para futuras implementaciones)
export const validateFile = (file: any, allowedTypes: string[], maxSize: number): boolean => {
  if (!file) return false;

  // Validar tipo de archivo
  if (!allowedTypes.includes(file.mimetype)) {
    return false;
  }

  // Validar tamaño
  if (file.size > maxSize) {
    return false;
  }

  return true;
};

export default {
  // Esquemas
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  logoutSchema,
  searchSongsSchema,
  createSongSchema,
  updateSongSchema,
  addToQueueSchema,
  updateQueueItemSchema,
  queueFiltersSchema,
  registerBarOwnerSchema,
  createAdminSchema,
  earnPointsSchema,
  redeemPointsSchema,
  pointsTransactionSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  createCategorySchema,

  // Utilidades
  validateRequest,
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateId,
  validateFile
};