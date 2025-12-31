import { closePool } from '../src/config/database';
import { redisClient } from '../src/config/redis';
import { mockAnthropicResponse } from './mocks/anthropic.mock';

// Mock Anthropic SDK globally to avoid API costs
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue(mockAnthropicResponse),
      },
    })),
  };
});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Cleanup after all tests
afterAll(async () => {
  await closePool();
  redisClient.disconnect();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key-at-least-32-characters-long-for-testing';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5434/mtg_agent';
process.env.REDIS_URL = 'redis://localhost:6379';
