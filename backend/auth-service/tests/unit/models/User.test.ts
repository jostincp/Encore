import { UserModel } from '../../../src/models/User';
import { pool } from '../../../src/config/database';
import { AppError } from '../../../../shared/utils/errors';
import {
  mockDbQuery,
  mockDbError,
  mockUser,
  expectError
} from '../../setup';

// Mock database pool
jest.mock('../../../src/config/database');
jest.mock('../../../../shared/utils/errors');

describe('UserModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const validUserData = {
      email: 'test@example.com',
      password_hash: 'hashed-password',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      role: 'customer' as const
    };

    it('should create a new user successfully', async () => {
      const expectedUser = {
        id: 'user-123',
        ...validUserData,
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDbQuery([expectedUser]);

      const result = await UserModel.create(validUserData);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          validUserData.email,
          validUserData.password_hash,
          validUserData.username,
          validUserData.first_name,
          validUserData.last_name,
          validUserData.role
        ])
      );
      expect(result).toEqual(expectedUser);
    });

    it('should handle database errors during creation', async () => {
      const dbError = new Error('Duplicate key violation');
      mockDbError(dbError);

      await expect(UserModel.create(validUserData)).rejects.toThrow(dbError);
    });

    it('should create user with default role if not provided', async () => {
      const userDataWithoutRole = {
        email: 'test@example.com',
        password_hash: 'hashed-password',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
      };

      const expectedUser = {
        id: 'user-123',
        ...userDataWithoutRole,
        role: 'customer',
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDbQuery([expectedUser]);

      const result = await UserModel.create(userDataWithoutRole);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          userDataWithoutRole.email,
          userDataWithoutRole.password_hash,
          userDataWithoutRole.username,
          userDataWithoutRole.first_name,
          userDataWithoutRole.last_name,
          'customer'
        ])
      );
      expect(result.role).toBe('customer');
    });
  });

  describe('findById', () => {
    it('should find user by id successfully', async () => {
      const userId = 'user-123';
      mockDbQuery([mockUser]);

      const result = await UserModel.findById(userId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id = $1'),
        [userId]
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      const userId = 'nonexistent-user';
      mockDbQuery([]); // Empty result

      const result = await UserModel.findById(userId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const userId = 'user-123';
      const dbError = new Error('Database connection failed');
      mockDbError(dbError);

      await expect(UserModel.findById(userId)).rejects.toThrow(dbError);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      const email = 'test@example.com';
      mockDbQuery([mockUser]);

      const result = await UserModel.findByEmail(email);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE email = $1'),
        [email]
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      const email = 'nonexistent@example.com';
      mockDbQuery([]); // Empty result

      const result = await UserModel.findByEmail(email);

      expect(result).toBeNull();
    });

    it('should handle case-insensitive email search', async () => {
      const email = 'TEST@EXAMPLE.COM';
      mockDbQuery([mockUser]);

      const result = await UserModel.findByEmail(email);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(email) = LOWER($1)'),
        [email]
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByUsername', () => {
    it('should find user by username successfully', async () => {
      const username = 'testuser';
      mockDbQuery([mockUser]);

      const result = await UserModel.findByUsername(username);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE username = $1'),
        [username]
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      const username = 'nonexistent';
      mockDbQuery([]); // Empty result

      const result = await UserModel.findByUsername(username);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const userId = 'user-123';
    const updateData = {
      first_name: 'Updated',
      last_name: 'Name',
      is_verified: true
    };

    it('should update user successfully', async () => {
      const updatedUser = {
        ...mockUser,
        ...updateData,
        updated_at: new Date()
      };

      mockDbQuery([updatedUser]);

      const result = await UserModel.update(userId, updateData);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining([userId])
      );
      expect(result).toEqual(updatedUser);
    });

    it('should return null if user not found', async () => {
      mockDbQuery([]); // Empty result

      const result = await UserModel.update('nonexistent-user', updateData);

      expect(result).toBeNull();
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { first_name: 'NewName' };
      const updatedUser = {
        ...mockUser,
        first_name: 'NewName',
        updated_at: new Date()
      };

      mockDbQuery([updatedUser]);

      const result = await UserModel.update(userId, partialUpdate);

      expect(result.first_name).toBe('NewName');
      expect(result.last_name).toBe(mockUser.last_name); // Should remain unchanged
    });

    it('should automatically update updated_at timestamp', async () => {
      const updatedUser = {
        ...mockUser,
        ...updateData,
        updated_at: new Date()
      };

      mockDbQuery([updatedUser]);

      const result = await UserModel.update(userId, updateData);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const userId = 'user-123';
      mockDbQuery([{ id: userId }]); // Simulate successful deletion

      const result = await UserModel.delete(userId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users WHERE id = $1'),
        [userId]
      );
      expect(result).toBe(true);
    });

    it('should return false if user not found', async () => {
      const userId = 'nonexistent-user';
      mockDbQuery([]); // Empty result

      const result = await UserModel.delete(userId);

      expect(result).toBe(false);
    });

    it('should handle database errors during deletion', async () => {
      const userId = 'user-123';
      const dbError = new Error('Foreign key constraint violation');
      mockDbError(dbError);

      await expect(UserModel.delete(userId)).rejects.toThrow(dbError);
    });
  });

  describe('findAll', () => {
    it('should find all users with default pagination', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-456', email: 'user2@example.com' }];
      mockDbQuery(users);

      const result = await UserModel.findAll();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        expect.arrayContaining([50, 0]) // Default limit and offset
      );
      expect(result).toEqual(users);
    });

    it('should find users with custom pagination', async () => {
      const users = [mockUser];
      const options = { limit: 10, offset: 20 };
      mockDbQuery(users);

      const result = await UserModel.findAll(options);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        expect.arrayContaining([10, 20])
      );
      expect(result).toEqual(users);
    });

    it('should find users with role filter', async () => {
      const adminUsers = [{ ...mockUser, role: 'admin' }];
      const options = { role: 'admin' as const };
      mockDbQuery(adminUsers);

      const result = await UserModel.findAll(options);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = $1'),
        expect.arrayContaining(['admin'])
      );
      expect(result).toEqual(adminUsers);
    });

    it('should find users with verification status filter', async () => {
      const verifiedUsers = [{ ...mockUser, is_verified: true }];
      const options = { is_verified: true };
      mockDbQuery(verifiedUsers);

      const result = await UserModel.findAll(options);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_verified = $1'),
        expect.arrayContaining([true])
      );
      expect(result).toEqual(verifiedUsers);
    });
  });

  describe('count', () => {
    it('should count all users', async () => {
      mockDbQuery([{ count: '25' }]);

      const result = await UserModel.count();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) FROM users')
      );
      expect(result).toBe(25);
    });

    it('should count users with filters', async () => {
      const filters = { role: 'admin' as const, is_verified: true };
      mockDbQuery([{ count: '5' }]);

      const result = await UserModel.count(filters);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE role = $1 AND is_verified = $2'),
        expect.arrayContaining(['admin', true])
      );
      expect(result).toBe(5);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const userId = 'user-123';
      const updatedUser = {
        ...mockUser,
        last_login_at: new Date(),
        updated_at: new Date()
      };

      mockDbQuery([updatedUser]);

      const result = await UserModel.updateLastLogin(userId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET last_login_at = CURRENT_TIMESTAMP'),
        [userId]
      );
      expect(result).toEqual(updatedUser);
    });

    it('should return null if user not found', async () => {
      const userId = 'nonexistent-user';
      mockDbQuery([]); // Empty result

      const result = await UserModel.updateLastLogin(userId);

      expect(result).toBeNull();
    });
  });

  describe('validateUserData', () => {
    it('should validate correct user data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
      };

      expect(() => UserModel.validateUserData(validData)).not.toThrow();
    });

    it('should throw error for invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'Password123!',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
      };

      expect(() => UserModel.validateUserData(invalidData)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('email'),
          statusCode: 400
        })
      );
    });

    it('should throw error for weak password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '123', // Too weak
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
      };

      expect(() => UserModel.validateUserData(invalidData)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('password'),
          statusCode: 400
        })
      );
    });

    it('should throw error for missing required fields', () => {
      const invalidData = {
        email: 'test@example.com'
        // Missing other required fields
      };

      expect(() => UserModel.validateUserData(invalidData)).toThrow(
        expect.objectContaining({
          statusCode: 400
        })
      );
    });
  });
});