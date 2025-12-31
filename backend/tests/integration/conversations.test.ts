import request from 'supertest';
import app from '../../src/index';
import { getPool } from '../../src/config/database';

// Anthropic SDK mocked globally in tests/setup.ts

describe('Conversations Integration Tests', () => {
  let sessionCookie: string[];

  beforeAll(async () => {
    // Clean up any existing conversation test users
    const pool = await getPool();
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['%convtest%']);

    // Create authenticated user
    const authResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'convtest-user@example.com',
        password: 'SecurePass123!',
      });

    sessionCookie = (authResponse.headers['set-cookie'] as unknown as string[]) || [];
  });

  afterAll(async () => {
    const pool = await getPool();
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['%convtest%']);
  });

  describe('POST /api/conversations', () => {
    it('should create a new conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Cookie', sessionCookie)
        .send({
          title: 'My First Conversation',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.conversation).toHaveProperty('id');
      expect(response.body.conversation.title).toBe('My First Conversation');
      expect(response.body.conversation.totalTokens).toBe(0);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({ title: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/conversations', () => {
    beforeEach(async () => {
      // Create a conversation for listing tests
      await request(app)
        .post('/api/conversations')
        .set('Cookie', sessionCookie)
        .send({ title: 'List Test Conversation' });
    });

    it('should list all conversations for authenticated user', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.conversations)).toBe(true);
      expect(response.body.conversations.length).toBeGreaterThan(0);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/conversations');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/conversations/:id', () => {
    let conversationId: string;

    beforeEach(async () => {
      // Create a conversation
      const createResponse = await request(app)
        .post('/api/conversations')
        .set('Cookie', sessionCookie)
        .send({ title: 'Detail Test Conversation' });

      conversationId = createResponse.body.conversation.id;

      // Add a message to the conversation
      await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          message: 'What is Flying in MTG?',
          conversationId,
        });
    });

    it('should get conversation with messages', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conversation.id).toBe(conversationId);
      expect(Array.isArray(response.body.messages)).toBe(true);
      expect(response.body.messages.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('maxTokens');
      expect(response.body).toHaveProperty('warningTokens');
    });

    it('should reject non-existent conversation ID', async () => {
      // Use a valid UUID format that doesn't exist in database
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/conversations/${nonExistentId}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get(`/api/conversations/${conversationId}`);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/conversations/:id', () => {
    let conversationId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/conversations')
        .set('Cookie', sessionCookie)
        .send({ title: 'Original Title' });

      conversationId = createResponse.body.conversation.id;
    });

    it('should update conversation title', async () => {
      const response = await request(app)
        .patch(`/api/conversations/${conversationId}`)
        .set('Cookie', sessionCookie)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated');
    });

    it('should reject empty title', async () => {
      const response = await request(app)
        .patch(`/api/conversations/${conversationId}`)
        .set('Cookie', sessionCookie)
        .send({ title: '' });

      expect(response.status).toBe(400);
    });

    it('should reject non-existent conversation ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .patch(`/api/conversations/${nonExistentId}`)
        .set('Cookie', sessionCookie)
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/conversations/:id', () => {
    let conversationId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/conversations')
        .set('Cookie', sessionCookie)
        .send({ title: 'To Delete' });

      conversationId = createResponse.body.conversation.id;
    });

    it('should soft delete conversation', async () => {
      const response = await request(app)
        .delete(`/api/conversations/${conversationId}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify it's deleted (should return 404)
      const getResponse = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Cookie', sessionCookie);

      expect(getResponse.status).toBe(404);
    });

    it('should reject non-existent conversation ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/conversations/${nonExistentId}`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/conversations/:id/summarize-and-continue', () => {
    let conversationId: string;

    beforeEach(async () => {
      // Create conversation
      const createResponse = await request(app)
        .post('/api/conversations')
        .set('Cookie', sessionCookie)
        .send({ title: 'To Summarize' });

      conversationId = createResponse.body.conversation.id;

      // Add multiple messages
      await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          message: 'What is Flying?',
          conversationId,
        });

      await request(app)
        .post('/api/chat')
        .set('Cookie', sessionCookie)
        .send({
          message: 'What is Trample?',
          conversationId,
        });
    });

    it('should summarize and create new conversation', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/summarize-and-continue`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('newConversationId');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.newConversationId).not.toBe(conversationId);

      // Verify new conversation exists
      const newConvResponse = await request(app)
        .get(`/api/conversations/${response.body.newConversationId}`)
        .set('Cookie', sessionCookie);

      expect(newConvResponse.status).toBe(200);
      expect(newConvResponse.body.conversation.title).toContain('Continued:');
    });

    it('should reject empty conversation', async () => {
      // Create empty conversation
      const emptyResponse = await request(app)
        .post('/api/conversations')
        .set('Cookie', sessionCookie)
        .send({ title: 'Empty' });

      const emptyId = emptyResponse.body.conversation.id;

      const response = await request(app)
        .post(`/api/conversations/${emptyId}/summarize-and-continue`)
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('empty');
    });
  });
});
