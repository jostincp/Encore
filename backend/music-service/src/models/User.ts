import { query, dbOperations } from '@shared/database';
import logger from '@shared/utils/logger';
import { ValidationError, NotFoundError } from '@shared/utils/errors';
import { validateId, validateEmail } from '@shared/utils/validation';

// User roles enumeration (unificados)
export enum UserRole {
  ADMIN = 'admin',
  BAR_OWNER = 'bar_owner',
  STAFF = 'staff',
  USER = 'user',
  GUEST = 'guest'
}

export interface UserData {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  is_verified: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  is_verified?: boolean;
  is_active?: boolean;
}

export class UserModel {
  static async create(data: CreateUserData): Promise<UserData> {
    try {
      // Validate required fields
      if (!data.email) {
        throw new ValidationError('Email is required');
      }
      if (!validateEmail(data.email)) {
        throw new ValidationError('Invalid email format');
      }

      const result = await query(
        `INSERT INTO users (
          email, first_name, last_name, role, is_verified, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          data.email,
          data.first_name || null,
          data.last_name || null,
          data.role || UserRole.USER,
          false, // is_verified
          true   // is_active
        ]
      );

      const user = result.rows[0];

      logger.info('User created', {
        id: user.id,
        email: user.email,
        role: user.role
      });

      return user;
    } catch (error) {
      logger.error('User creation error:', error);
      throw error;
    }
  }

  static async findById(id: string): Promise<UserData | null> {
    try {
      if (!validateId(id)) {
        throw new ValidationError('Invalid ID format');
      }

      const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('User find by ID error:', error);
      throw error;
    }
  }

  static async findByEmail(email: string): Promise<UserData | null> {
    try {
      if (!validateEmail(email)) {
        throw new ValidationError('Invalid email format');
      }

      const result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('User find by email error:', error);
      throw error;
    }
  }

  static async update(id: string, data: UpdateUserData): Promise<UserData | null> {
    try {
      if (!validateId(id)) {
        throw new ValidationError('Invalid ID format');
      }

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.first_name !== undefined) {
        updateFields.push(`first_name = $${paramIndex}`);
        params.push(data.first_name);
        paramIndex++;
      }

      if (data.last_name !== undefined) {
        updateFields.push(`last_name = $${paramIndex}`);
        params.push(data.last_name);
        paramIndex++;
      }

      if (data.role !== undefined) {
        updateFields.push(`role = $${paramIndex}`);
        params.push(data.role);
        paramIndex++;
      }

      if (data.is_verified !== undefined) {
        updateFields.push(`is_verified = $${paramIndex}`);
        params.push(data.is_verified);
        paramIndex++;
      }

      if (data.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      const queryStr = `
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      params.push(id);

      const result = await query(queryStr, params);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];

      logger.info('User updated', {
        id,
        updatedFields: Object.keys(data)
      });

      return user;
    } catch (error) {
      logger.error('User update error:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      if (!validateId(id)) {
        throw new ValidationError('Invalid ID format');
      }

      const result = await query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id]
      );

      const deleted = result.rows.length > 0;

      if (deleted) {
        logger.info('User deleted', { id });
      }

      return deleted;
    } catch (error) {
      logger.error('User delete error:', error);
      throw error;
    }
  }

  static async findMany(options: {
    role?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: UserData[]; total: number }> {
    try {
      const { role, is_active, limit = 50, offset = 0 } = options;

      let whereConditions = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (role) {
        whereConditions.push(`role = $${paramIndex}`);
        params.push(role);
        paramIndex++;
      }

      if (is_active !== undefined) {
        whereConditions.push(`is_active = $${paramIndex}`);
        params.push(is_active);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      // Count query
      const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      const countResult = await query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Main query
      const queryStr = `
        SELECT * FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await query(queryStr, params);

      logger.debug('Users retrieved', {
        total,
        returned: result.rows.length,
        filters: options
      });

      return {
        items: result.rows,
        total
      };
    } catch (error) {
      logger.error('User find many error:', error);
      throw error;
    }
  }
}