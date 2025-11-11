/**
 * Encore Platform - Auth Service API Integration Tests
 * Tests de integración para la API de autenticación
 */

const request = require('supertest');
const { createApp } = require('../../../backend/auth-service/src/app');
const { initializeDatabase, closeDatabase } = require('../../../backend/auth-service/src/utils/database');
const { User } = require('../../../backend/auth-service/src/models/User');
const { RefreshToken } = require('../../../backend/auth-service/src/models/RefreshToken');

describe('Auth Service API Integration Tests', () => {
  let app;
  let server;
  let testUser;
  let accessToken;
  let refreshToken;

  beforeAll(async () => {
    // Inicializar base de datos de test
    await initializeDatabase();

    // Crear aplicación de test
    app = createApp();
    server = app.listen(0); // Puerto automático

    // Limpiar datos de test previos
    await User.destroy({ where: {}, force: true });
    await RefreshToken.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    // Cerrar servidor y base de datos
    if (server) {
      server.close();
    }
    await closeDatabase();
  });

  beforeEach(async () => {
    // Limpiar datos entre tests
    await User.destroy({ where: {}, force: true });
    await RefreshToken.destroy({ where: {}, force: true });

    // Crear usuario de test
    testUser = await User.create({
      email: 'test@example.com',
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6fYzYXxGK', // 'password123'
      firstName: 'John',
      lastName: 'Doe',
      role: 'customer',
      isActive: true
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'ValidPass123!',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      // Verificar que el usuario fue creado en la base de datos
      const createdUser = await User.findOne({ where: { email: userData.email } });
      expect(createdUser).toBeDefined();
      expect(createdUser.firstName).toBe(userData.firstName);
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com', // Email ya existente
        password: 'ValidPass123!',
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ya existe');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123',
        firstName: '',
        lastName: ''
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        email: 'weak@example.com',
        password: '123',
        firstName: 'Weak',
        lastName: 'Password'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('contraseña');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.tokens).toBeDefined();

      // Guardar tokens para otros tests
      accessToken = response.body.data.tokens.accessToken;
      refreshToken = response.body.data.tokens.refreshToken;

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
    });

    it('should return error for invalid credentials', async () => {
      const invalidLoginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidLoginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('credenciales');
    });

    it('should return error for non-existent user', async () => {
      const nonExistentUserData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(nonExistentUserData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('credenciales');
    });

    it('should handle rate limiting', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Hacer múltiples intentos fallidos
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData);
      }

      // El último intento debería ser rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(429);

      expect(response.body.error).toContain('rate limit');
    });
  });

  describe('POST /api/auth/refresh', () => {
    beforeEach(async () => {
      // Login para obtener tokens válidos
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      // Los nuevos tokens deberían ser diferentes
      expect(response.body.data.tokens.accessToken).not.toBe(accessToken);
      expect(response.body.data.tokens.refreshToken).not.toBe(refreshToken);
    });

    it('should return error for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });

    it('should return error for revoked refresh token', async () => {
      // Revocar el token
      await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      // Intentar usar el token revocado
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });
  });

  describe('GET /api/auth/profile', () => {
    beforeEach(async () => {
      // Login para obtener token de acceso
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
    });

    it('should return user profile successfully', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.firstName).toBe('John');
      expect(response.body.data.user.lastName).toBe('Doe');
    });

    it('should return error for missing authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });

    it('should return error for expired token', async () => {
      // Crear un token expirado (esto requeriría manipular el tiempo)
      // En un test real, podrías mockear la verificación JWT
      const expiredToken = 'expired.jwt.token';

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      // Login para obtener tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout');

      // Verificar que el refresh token fue revocado
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(refreshResponse.body.success).toBe(false);
    });

    it('should handle logout without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in all responses', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-api-version']).toBeDefined();
      expect(response.headers['x-powered-by']).toBe('Encore Platform');
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect(200);

      // En configuración restrictiva, debería no incluir allow-origin
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('auth-service');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBeDefined();
    });

    it('should also respond on /api/health', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.service).toBe('auth-service');
    });
  });
});