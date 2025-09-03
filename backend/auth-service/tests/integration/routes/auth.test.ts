import request from 'supertest';
import { app } from '../../../src/app';
import { pool } from '../../../src/config/database';
import { redisClient } from '../../../src/config/redis';
import { EmailService } from '../../../src/services/emailService';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock external services
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/config/redis');

describe('Auth Routes Integration Tests', () => {
  let testUser: any;
  const testUserData = {
    email: 'test@example.com',
    password: 'Password123!',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
    role: 'customer'
  };

  beforeAll(async () => {
    // Setup test database connection
    await pool.query('BEGIN');
  });

  afterAll(async () => {
    // Cleanup test database
    await pool.query('ROLLBACK');
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await pool.query('DELETE FROM users WHERE email = $1', [testUserData.email]);
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Mock email service
      (EmailService.sendVerificationEmail as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUserData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.',
        data: {
          user: {
            email: testUserData.email,
            username: testUserData.username,
            first_name: testUserData.first_name,
            last_name: testUserData.last_name,
            role: testUserData.role,
            is_verified: false
          }
        }
      });

      // Verify user was created in database
      const dbResult = await pool.query('SELECT * FROM users WHERE email = $1', [testUserData.email]);
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].email).toBe(testUserData.email);
      expect(dbResult.rows[0].is_verified).toBe(false);

      // Verify email service was called
      expect(EmailService.sendVerificationEmail).toHaveBeenCalledWith(
        testUserData.email,
        expect.any(String)
      );
    });

    it('should return 400 for duplicate email', async () => {
      // Create user first
      const hashedPassword = await bcrypt.hash(testUserData.password, 12);
      await pool.query(
        'INSERT INTO users (email, password_hash, username, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5, $6)',
        [testUserData.email, hashedPassword, testUserData.username, testUserData.first_name, testUserData.last_name, testUserData.role]
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUserData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'User with this email already exists'
      });
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = { ...testUserData, email: 'invalid-email' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    it('should return 400 for weak password', async () => {
      const invalidData = { ...testUserData, password: '123' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = { email: testUserData.email };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create verified test user
      const hashedPassword = await bcrypt.hash(testUserData.password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, username, first_name, last_name, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [testUserData.email, hashedPassword, testUserData.username, testUserData.first_name, testUserData.last_name, testUserData.role, true]
      );
      testUser = result.rows[0];
    });

    it('should login user successfully', async () => {
      const loginData = {
        email: testUserData.email,
        password: testUserData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: testUser.id,
            email: testUser.email,
            username: testUser.username,
            role: testUser.role
          },
          token: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify JWT token is valid
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded).toMatchObject({
        id: testUser.id,
        email: testUser.email
      });

      // Verify last_login_at was updated
      const updatedUser = await pool.query('SELECT last_login_at FROM users WHERE id = $1', [testUser.id]);
      expect(updatedUser.rows[0].last_login_at).toBeTruthy();
    });

    it('should return 401 for invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: testUserData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid credentials'
      });
    });

    it('should return 401 for invalid password', async () => {
      const loginData = {
        email: testUserData.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid credentials'
      });
    });

    it('should return 401 for unverified user', async () => {
      // Update user to unverified
      await pool.query('UPDATE users SET is_verified = false WHERE id = $1', [testUser.id]);

      const loginData = {
        email: testUserData.email,
        password: testUserData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Please verify your email before logging in'
      });
    });
  });

  describe('GET /api/auth/verify/:token', () => {
    beforeEach(async () => {
      // Create unverified test user
      const hashedPassword = await bcrypt.hash(testUserData.password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, username, first_name, last_name, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [testUserData.email, hashedPassword, testUserData.username, testUserData.first_name, testUserData.last_name, testUserData.role, false]
      );
      testUser = result.rows[0];
    });

    it('should verify email successfully', async () => {
      // Generate valid verification token
      const token = jwt.sign(
        { email: testUserData.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .get(`/api/auth/verify/${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Email verified successfully'
      });

      // Verify user is now verified in database
      const updatedUser = await pool.query('SELECT is_verified, email_verified_at FROM users WHERE id = $1', [testUser.id]);
      expect(updatedUser.rows[0].is_verified).toBe(true);
      expect(updatedUser.rows[0].email_verified_at).toBeTruthy();
    });

    it('should return 400 for invalid token', async () => {
      const invalidToken = 'invalid-token';

      const response = await request(app)
        .get(`/api/auth/verify/${invalidToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid or expired verification token'
      });
    });

    it('should return 400 for expired token', async () => {
      // Generate expired token
      const expiredToken = jwt.sign(
        { email: testUserData.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get(`/api/auth/verify/${expiredToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid or expired verification token'
      });
    });

    it('should return 404 for non-existent user', async () => {
      // Generate token for non-existent user
      const token = jwt.sign(
        { email: 'nonexistent@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .get(`/api/auth/verify/${token}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      // Create verified test user
      const hashedPassword = await bcrypt.hash(testUserData.password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, username, first_name, last_name, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [testUserData.email, hashedPassword, testUserData.username, testUserData.first_name, testUserData.last_name, testUserData.role, true]
      );
      testUser = result.rows[0];
    });

    it('should send password reset email for existing user', async () => {
      // Mock email service
      (EmailService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUserData.email })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset email sent successfully'
      });

      expect(EmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        testUserData.email,
        expect.any(String)
      );
    });

    it('should return success even for non-existent user (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset email sent successfully'
      });

      // Email service should not be called for non-existent user
      expect(EmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    beforeEach(async () => {
      // Create verified test user
      const hashedPassword = await bcrypt.hash(testUserData.password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, username, first_name, last_name, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [testUserData.email, hashedPassword, testUserData.username, testUserData.first_name, testUserData.last_name, testUserData.role, true]
      );
      testUser = result.rows[0];
    });

    it('should reset password successfully', async () => {
      // Generate valid reset token
      const resetToken = jwt.sign(
        { email: testUserData.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const newPassword = 'NewPassword123!';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: newPassword })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset successfully'
      });

      // Verify password was updated in database
      const updatedUser = await pool.query('SELECT password_hash, password_reset_at FROM users WHERE id = $1', [testUser.id]);
      const isNewPasswordValid = await bcrypt.compare(newPassword, updatedUser.rows[0].password_hash);
      expect(isNewPasswordValid).toBe(true);
      expect(updatedUser.rows[0].password_reset_at).toBeTruthy();

      // Verify old password no longer works
      const isOldPasswordValid = await bcrypt.compare(testUserData.password, updatedUser.rows[0].password_hash);
      expect(isOldPasswordValid).toBe(false);
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token', password: 'NewPassword123!' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid or expired reset token'
      });
    });

    it('should return 400 for weak new password', async () => {
      const resetToken = jwt.sign(
        { email: testUserData.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: '123' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create verified test user
      const hashedPassword = await bcrypt.hash(testUserData.password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, username, first_name, last_name, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [testUserData.email, hashedPassword, testUserData.username, testUserData.first_name, testUserData.last_name, testUserData.role, true]
      );
      testUser = result.rows[0];

      // Generate refresh token
      refreshToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { expiresIn: '7d' }
      );
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          token: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify new token is valid
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded).toMatchObject({
        id: testUser.id,
        email: testUser.email
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid refresh token'
      });
    });

    it('should return 404 if user not found', async () => {
      // Delete user
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      // Create verified test user
      const hashedPassword = await bcrypt.hash(testUserData.password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, username, first_name, last_name, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [testUserData.email, hashedPassword, testUserData.username, testUserData.first_name, testUserData.last_name, testUserData.role, true]
      );
      testUser = result.rows[0];

      // Generate auth token
      authToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});