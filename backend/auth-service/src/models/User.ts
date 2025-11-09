import { query, dbOperations } from '../utils/database';
import { User } from '../types/models';
import { validateUserRegistration, ValidationResult } from '../utils/validation';
import { UserRole, VALID_USER_ROLES, assertValidUserRole, isValidUserRole } from '../constants/roles';

// Re-export User interface for external use
export { User } from '../types/models';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  phone?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  role?: UserRole;
}

export class UserModel {
  /**
   * Create a new user
   */
  static async create(userData: CreateUserData): Promise<User> {
    // Validate user data
    const validation = validateUserRegistration({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName
    });

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Validate role if provided
    if (userData.role && !isValidUserRole(userData.role)) {
      throw new Error(`Invalid user role: ${userData.role}`);
    }

    // Check if user already exists
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Create user
    const user = await dbOperations.create<User>('users', {
      id: uuidv4(),
      email: userData.email.toLowerCase(),
      password_hash: passwordHash,
      first_name: userData.firstName,
      last_name: userData.lastName,
      role: userData.role || UserRole.USER,
      phone: userData.phone || null,
      is_active: true,
      email_verified: false
    });

    // Remove password hash from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const user = await dbOperations.findById<User>('users', id);
    if (user) {
      const { password_hash, ...userWithoutPassword } = user as any;
      return userWithoutPassword as User;
    }
    return null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length > 0) {
      const { password_hash, ...userWithoutPassword } = result.rows[0] as any;
      return userWithoutPassword as User;
    }
    return null;
  }

  /**
   * Find user by email with password (for authentication)
   */
  static async findByEmailWithPassword(email: string): Promise<(User & { password_hash: string }) | null> {
    const result = await query<User & { password_hash: string }>(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Update user
   */
  static async update(id: string, userData: UpdateUserData): Promise<User | null> {
    // Validate role if provided
    if (userData.role && !isValidUserRole(userData.role)) {
      throw new Error(`Invalid user role: ${userData.role}`);
    }

    const updateData: Record<string, any> = {};

    if (userData.firstName) updateData.first_name = userData.firstName;
    if (userData.lastName) updateData.last_name = userData.lastName;
    if (userData.email) updateData.email = userData.email;
    if (userData.phone !== undefined) updateData.phone = userData.phone;
    if (userData.avatarUrl !== undefined) updateData.avatar_url = userData.avatarUrl;
    if (userData.isActive !== undefined) updateData.is_active = userData.isActive;
    if (userData.isEmailVerified !== undefined) updateData.email_verified = userData.isEmailVerified;
    if (userData.role) updateData.role = userData.role;

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    const user = await dbOperations.update<User>('users', id, updateData);
    if (user) {
      const { password_hash, ...userWithoutPassword } = user as any;
      return userWithoutPassword as User;
    }
    return null;
  }

  /**
   * Update user password
   */
  static async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id]
    );
    
    return (result.rowCount || 0) > 0;
  }

  /**
   * Verify user password
   */
  static async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmailWithPassword(email);
    if (!user) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * Verify user email
   */
  static async verifyEmail(id: string): Promise<boolean> {
    const result = await query(
      'UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    return (result.rowCount || 0) > 0;
  }

  /**
   * Deactivate user
   */
  static async deactivate(id: string): Promise<boolean> {
    const result = await query(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get users with pagination
   */
  static async findMany(options: {
    limit?: number;
    offset?: number;
    role?: string;
    isActive?: boolean;
    search?: string;
  } = {}): Promise<{ users: User[]; total: number }> {
    const { limit = 50, offset = 0, role, isActive, search } = options;
    
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const usersResult = await query<User>(
      `SELECT id, email, first_name, last_name, role, is_active, email_verified, phone, avatar_url, created_at, updated_at 
       FROM users ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      users: usersResult.rows,
      total
    };
  }

  /**
   * Delete user (hard delete)
   */
  static async delete(id: string): Promise<boolean> {
    return await dbOperations.delete('users', id);
  }
}