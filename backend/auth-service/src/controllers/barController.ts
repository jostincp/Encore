import { Request, Response } from 'express';
import { getPool } from '../../../shared/database';
import logger from '../../../shared/utils/logger';
import { AuthenticatedRequest } from '../../../shared/utils/jwt';
import { UserRole } from '../../../shared/types/index';

/**
 * Obtener información de un bar para personalizar la experiencia del cliente
 */
export const getBarInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { barId } = req.params;

    if (!barId) {
      res.status(400).json({
        success: false,
        message: 'Se requiere barId'
      });
      return;
    }

    // TODO: Obtener información real de la base de datos
    // Por ahora, devolvemos datos mock para testing
    const mockBarInfo = {
      id: barId,
      name: 'Rockola Bar Encore',
      description: 'El mejor bar con música en vivo',
      logo: 'https://example.com/logo.png',
      primaryColor: '#f3760b',
      secondaryColor: '#1e293b',
      theme: 'dark',
      settings: {
        allowSongRequests: true,
        requireApproval: true,
        maxQueueLength: 20,
        pointsPerSong: 50,
        priorityMultiplier: 2
      },
      address: {
        street: 'Calle de la Música 123',
        city: 'Madrid',
        country: 'España'
      },
      contact: {
        phone: '+34 900 123 456',
        email: 'hola@rockolabar.com'
      },
      social: {
        instagram: '@rockolabar',
        twitter: '@rockolabar'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    logger.info(`Bar info requested: ${barId}`);

    res.json({
      success: true,
      data: mockBarInfo,
      message: 'Información del bar obtenida exitosamente'
    });

  } catch (error) {
    logger.error('Error fetching bar info:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del bar',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export class BarController {
  /**
   * Crear un nuevo bar (solo admin)
   */
  static async createBar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, description, address, phone, email, settings } = req.body;
      const ownerId = req.user!.userId;

      // Verificar permisos
      if (req.user!.role !== UserRole.ADMIN && req.user!.role !== UserRole.BAR_OWNER) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear bares'
        });
        return;
      }

      const pool = getPool();
      const result = await pool.query(`
        INSERT INTO bars (name, description, address, phone, email, owner_id, settings, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, name, description, address, phone, email, owner_id, settings, created_at
      `, [name, description, address, phone, email, ownerId, JSON.stringify(settings || {})]);

      const bar = result.rows[0];

      logger.info(`Bar created: ${bar.id} by user ${ownerId}`);

      res.status(201).json({
        success: true,
        data: bar,
        message: 'Bar creado exitosamente'
      });

    } catch (error) {
      logger.error('Error creating bar:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener bares del usuario actual
   */
  static async getMyBars(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const pool = getPool();
      
      const result = await pool.query(`
        SELECT id, name, description, address, phone, email, owner_id, settings, is_active, created_at, updated_at
        FROM bars
        WHERE owner_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      res.json({
        success: true,
        data: {
          bars: result.rows
        }
      });

    } catch (error) {
      logger.error('Error getting my bars:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener todos los bares
   */
  static async getBars(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const pool = getPool();
      let query = `
        SELECT id, name, description, address, phone, email, owner_id, settings, is_active, created_at, updated_at
        FROM bars
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Filtros de búsqueda
      if (search) {
        query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR address ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Si no es admin, solo mostrar bares propios o activos
      if (userRole !== UserRole.ADMIN) {
        if (userRole === UserRole.BAR_OWNER) {
          query += ` AND (owner_id = $${paramIndex} OR is_active = true)`;
          params.push(userId);
        } else {
          query += ` AND is_active = true`;
        }
        paramIndex++;
      }

      // Paginación
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string), offset);

      const result = await pool.query(query, params);

      // Contar total
      let countQuery = 'SELECT COUNT(*) FROM bars WHERE 1=1';
      const countParams: any[] = [];
      let countParamIndex = 1;

      if (search) {
        countQuery += ` AND (name ILIKE $${countParamIndex} OR description ILIKE $${countParamIndex} OR address ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      if (userRole !== UserRole.ADMIN) {
        if (userRole === UserRole.BAR_OWNER) {
          countQuery += ` AND (owner_id = $${countParamIndex} OR is_active = true)`;
          countParams.push(userId);
        } else {
          countQuery += ` AND is_active = true`;
        }
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      });

    } catch (error) {
      logger.error('Error getting bars:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener bar por ID
   */
  static async getBarById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const pool = getPool();
      const result = await pool.query(`
        SELECT id, name, description, address, phone, email, owner_id, settings, is_active, created_at, updated_at
        FROM bars
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Bar no encontrado'
        });
        return;
      }

      const bar = result.rows[0];

      // Verificar permisos
      if (userRole !== UserRole.ADMIN && bar.owner_id !== userId && !bar.is_active) {
        res.status(403).json({
          success: false,
          message: 'No tienes acceso a este bar'
        });
        return;
      }

      res.json({
        success: true,
        data: bar
      });

    } catch (error) {
      logger.error('Error getting bar by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Actualizar bar
   */
  static async updateBar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, address, phone, email, settings, is_active } = req.body;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const pool = getPool();

      // Verificar que el bar existe y obtener propietario
      const barResult = await pool.query(
        'SELECT owner_id FROM bars WHERE id = $1',
        [id]
      );

      if (barResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Bar no encontrado'
        });
        return;
      }

      // Verificar permisos
      if (userRole !== UserRole.ADMIN && barResult.rows[0].owner_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar este bar'
        });
        return;
      }

      // Construir query de actualización
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(name);
        paramIndex++;
      }

      if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(description);
        paramIndex++;
      }

      if (address !== undefined) {
        updates.push(`address = $${paramIndex}`);
        params.push(address);
        paramIndex++;
      }

      if (phone !== undefined) {
        updates.push(`phone = $${paramIndex}`);
        params.push(phone);
        paramIndex++;
      }

      if (email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        params.push(email);
        paramIndex++;
      }

      if (settings !== undefined) {
        updates.push(`settings = $${paramIndex}`);
        params.push(JSON.stringify(settings));
        paramIndex++;
      }

      if (is_active !== undefined && userRole === UserRole.ADMIN) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No hay campos para actualizar'
        });
        return;
      }

      updates.push(`updated_at = NOW()`);

      const query = `
        UPDATE bars
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, description, address, phone, email, owner_id, settings, is_active, updated_at
      `;
      params.push(id);

      const result = await pool.query(query, params);
      const updatedBar = result.rows[0];

      logger.info(`Bar updated: ${id} by user ${userId}`);

      res.json({
        success: true,
        data: updatedBar,
        message: 'Bar actualizado exitosamente'
      });

    } catch (error) {
      logger.error('Error updating bar:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Crear mesa para un bar
   */
  static async createTable(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const { table_number, capacity, is_active = true } = req.body;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const pool = getPool();

      // Verificar que el bar existe y el usuario tiene permisos
      const barResult = await pool.query(
        'SELECT owner_id FROM bars WHERE id = $1',
        [barId]
      );

      if (barResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Bar no encontrado'
        });
        return;
      }

      if (userRole !== UserRole.ADMIN && barResult.rows[0].owner_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos para gestionar mesas en este bar'
        });
        return;
      }

      // Verificar que el número de mesa no existe
      const existingTable = await pool.query(
        'SELECT id FROM tables WHERE bar_id = $1 AND table_number = $2',
        [barId, table_number]
      );

      if (existingTable.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: 'Ya existe una mesa con este número'
        });
        return;
      }

      // Crear mesa
      const result = await pool.query(`
        INSERT INTO tables (bar_id, table_number, capacity, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id, bar_id, table_number, capacity, is_active, created_at
      `, [barId, table_number, capacity, is_active]);

      const table = result.rows[0];

      logger.info(`Table created: ${table.id} for bar ${barId} by user ${userId}`);

      res.status(201).json({
        success: true,
        data: table,
        message: 'Mesa creada exitosamente'
      });

    } catch (error) {
      logger.error('Error creating table:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Generar código QR para una mesa
   */
  static async generateTableQR(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId, tableId } = req.params;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const pool = getPool();

      // Verificar permisos
      const barResult = await pool.query(
        'SELECT owner_id FROM bars WHERE id = $1',
        [barId]
      );

      if (barResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Bar no encontrado'
        });
        return;
      }

      if (userRole !== UserRole.ADMIN && barResult.rows[0].owner_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos para generar códigos QR en este bar'
        });
        return;
      }

      // Verificar que la mesa existe
      const tableResult = await pool.query(
        'SELECT table_number FROM tables WHERE id = $1 AND bar_id = $2',
        [tableId, barId]
      );

      if (tableResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Mesa no encontrada'
        });
        return;
      }

      // Generar URL del QR
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const qrUrl = `${baseUrl}/client/music?b=${barId}&t=${tableId}`;

      // Aquí se podría integrar una librería de QR como qrcode.js
      // Por ahora, devolver la URL que será usada para generar el QR en el frontend

      res.json({
        success: true,
        data: {
          barId,
          tableId,
          tableNumber: tableResult.rows[0].table_number,
          qrUrl,
          qrData: qrUrl // Datos que se usarán para generar el código QR
        },
        message: 'Código QR generado exitosamente'
      });

    } catch (error) {
      logger.error('Error generating table QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Obtener mesas de un bar
   */
  static async getBarTables(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barId } = req.params;
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      const pool = getPool();

      // Verificar permisos
      const barResult = await pool.query(
        'SELECT owner_id FROM bars WHERE id = $1',
        [barId]
      );

      if (barResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Bar no encontrado'
        });
        return;
      }

      if (userRole !== UserRole.ADMIN && barResult.rows[0].owner_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver las mesas de este bar'
        });
        return;
      }

      const result = await pool.query(`
        SELECT id, bar_id, table_number, capacity, is_active, created_at, updated_at
        FROM tables
        WHERE bar_id = $1
        ORDER BY table_number
      `, [barId]);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      logger.error('Error getting bar tables:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}