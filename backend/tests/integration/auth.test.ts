import request from 'supertest';
import app from '../../src/index';
import { getPool } from '../../src/config/database';

describe('Auth Integration Tests', () => {
  beforeEach(async () => {
    // Clean database before each test (match both test.example.com and test@example.com)
    const pool = await getPool();
    await pool.query('DELETE FROM users WHERE email LIKE $1 OR email LIKE $2', ['%test.example.com%', '%test@example.com%']);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully with session', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.example.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(201);
      expect(response.headers['set-cookie']).toBeDefined(); // Session cookie
      expect(response.body.user.email).toBe('newuser@test.example.com');
      expect(response.body.user.tier).toBe('free'); // Default tier
      expect(response.body.user.role).toBe('user'); // Default role
      expect(response.body.user).not.toHaveProperty('password_hash');
      expect(response.body).not.toHaveProperty('token'); // No JWT tokens
    });

    it('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weakpass@test.example.com',
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });

    it('should reject duplicate email', async () => {
      const email = 'duplicate@test.example.com';

      // First registration
      await request(app).post('/api/auth/register').send({
        email,
        password: 'SecurePass123!',
      });

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'AnotherPass123!',
        });

      expect(response.status).toBe(409);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const testUser = {
      email: 'logintest@test.example.com',
      password: 'SecurePass123!',
    };

    beforeEach(async () => {
      // Create test user
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login successfully with correct credentials and session', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUser);

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined(); // Session cookie set
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.role).toBe('user');
      expect(response.body).not.toHaveProperty('token'); // No JWT tokens
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.example.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user data with valid session', async () => {
      // Register and login
      const loginResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'metest@test.example.com',
          password: 'SecurePass123!',
        });

      const cookies = (loginResponse.headers['set-cookie'] as unknown as string[]) || [];

      // Get user data with session cookie
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('metest@test.example.com');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should reject request without session', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should include user role in response', async () => {
      // Register and login
      const loginResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'roletest@test.example.com',
          password: 'SecurePass123!',
        });

      const cookies = (loginResponse.headers['set-cookie'] as unknown as string[]) || [];

      // Get user data
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('user'); // Default role
      expect(response.body.user.tier).toBe('free'); // Default tier
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and destroy session', async () => {
      // Register and login
      const loginResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logouttest@test.example.com',
          password: 'SecurePass123!',
        });

      const cookies = (loginResponse.headers['set-cookie'] as unknown as string[]) || [];

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies);

      expect(logoutResponse.status).toBe(200);

      // Try to access protected endpoint with old session
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meResponse.status).toBe(401);
    });
  });
});
