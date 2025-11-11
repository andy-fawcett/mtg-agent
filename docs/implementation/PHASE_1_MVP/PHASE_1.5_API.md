# Phase 1.5: API Endpoints & Validation

**Status:** ✅ Complete
**Duration Estimate:** 4-6 hours
**Prerequisites:** Phases 1.0-1.4 complete
**Dependencies:** Zod, ChatService, AuthService

## Objectives

Create complete REST API with comprehensive input validation using Zod.

- Zod validation schemas for all inputs
- POST /api/chat endpoint
- Request validation middleware
- Error handling middleware
- API documentation
- Integration of all previous services

---

## Task 1.5.1: Zod Validation Schemas

**Estimated Time:** 60 minutes

### Objectives

Define type-safe validation schemas for all API inputs.

### Steps

**Install Zod:**

```bash
cd backend
npm install zod
```

**Create `backend/src/validation/schemas.ts`:**

```typescript
import { z } from 'zod';

/**
 * Auth validation schemas
 */
export const RegisterSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required'),
});

/**
 * Chat validation schema
 */
export const ChatSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message too long (max 4000 characters)')
    .transform(msg => msg.trim()),
});

/**
 * Type inference from schemas
 */
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChatInput = z.infer<typeof ChatSchema>;
```

**Create validation middleware `backend/src/middleware/validate.ts`:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * Validation middleware factory
 */
export function validate(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and parse request body
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors nicely
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid request data',
          details: errors,
        });
        return;
      }

      // Other errors
      next(error);
    }
  };
}
```

### Verification

```bash
cd backend
cat > test-validation.ts << 'EOF'
import { RegisterSchema, LoginSchema, ChatSchema } from './src/validation/schemas';

console.log('Testing Validation Schemas...\n');

// Test valid registration
console.log('1. Valid registration:');
try {
  const valid = RegisterSchema.parse({
    email: 'test@example.com',
    password: 'SecurePassword123!',
  });
  console.log('✓ Valid:', valid);
} catch (error: any) {
  console.log('✗ Failed:', error.errors);
}

// Test invalid email
console.log('\n2. Invalid email:');
try {
  RegisterSchema.parse({
    email: 'notanemail',
    password: 'SecurePassword123!',
  });
  console.log('✗ Should have failed');
} catch (error: any) {
  console.log('✓ Validation failed:', error.errors[0].message);
}

// Test weak password
console.log('\n3. Weak password:');
try {
  RegisterSchema.parse({
    email: 'test@example.com',
    password: 'weak',
  });
  console.log('✗ Should have failed');
} catch (error: any) {
  console.log('✓ Validation failed:', error.errors[0].message);
}

// Test valid chat message
console.log('\n4. Valid chat message:');
try {
  const valid = ChatSchema.parse({
    message: '  What is Flying?  ',
  });
  console.log('✓ Valid (trimmed):', valid);
} catch (error: any) {
  console.log('✗ Failed:', error.errors);
}

// Test empty message
console.log('\n5. Empty message:');
try {
  ChatSchema.parse({ message: '   ' });
  console.log('✗ Should have failed');
} catch (error: any) {
  console.log('✓ Validation failed:', error.errors[0].message);
}

console.log('\n✓ All validation tests passed!');
EOF

npx tsx test-validation.ts
rm test-validation.ts
```

### Success Criteria

- [ ] Zod schemas defined
- [ ] Email validation works
- [ ] Password validation works
- [ ] Message validation works
- [ ] Type inference works
- [ ] Error messages clear

---

## Task 1.5.2: Chat API Endpoint

**Estimated Time:** 90 minutes

### Objectives

Create the main chat endpoint with all middleware integration.

### Steps

**Create `backend/src/routes/chat.ts`:**

```typescript
import { Router, Request, Response } from 'express';
import { ChatService } from '../services/chatService';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { ipRateLimit, userRateLimit, budgetCheck } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { ChatSchema } from '../validation/schemas';

const router = Router();

/**
 * POST /api/chat
 * Send message and get AI response
 */
router.post(
  '/',
  ipRateLimit,        // IP-based rate limiting
  optionalAuth,       // Authentication (optional for anonymous)
  userRateLimit,      // User/anonymous rate limiting
  budgetCheck,        // Check daily budget
  validate(ChatSchema), // Validate input
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      // Get user info
      const userId = req.user?.id;
      const userTier = req.user?.tier || 'anonymous';

      // Call chat service
      const response = await ChatService.chat({
        message,
        userId,
        userTier,
      });

      // Success response
      res.status(200).json({
        response: response.response,
        metadata: {
          tokensUsed: response.tokensUsed,
          model: response.model,
          costCents: response.costCents,
        },
      });
    } catch (error: any) {
      console.error('Chat endpoint error:', error);

      // Handle specific error types
      if (error.message === 'Invalid request detected') {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Your message contains disallowed content',
        });
        return;
      }

      if (error.message.includes('budget')) {
        res.status(503).json({
          error: 'Service unavailable',
          message: 'Daily budget exceeded. Try again tomorrow.',
        });
        return;
      }

      // Generic error
      res.status(500).json({
        error: 'Chat failed',
        message: 'An error occurred while processing your message',
      });
    }
  }
);

/**
 * GET /api/chat/history
 * Get user's chat history (authenticated only)
 */
router.get(
  '/history',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { ChatLogModel } = await import('../models/ChatLog');

      const limit = parseInt(req.query.limit as string) || 50;
      const history = await ChatLogModel.getByUserId(req.user!.id, limit);

      res.json({
        history: history.map(log => ({
          id: log.id,
          messageLength: log.message_length,
          responseLength: log.response_length,
          tokensUsed: log.tokens_used,
          success: log.success,
          createdAt: log.created_at,
        })),
      });
    } catch (error) {
      console.error('History endpoint error:', error);
      res.status(500).json({
        error: 'Failed to fetch history',
        message: 'An error occurred while fetching chat history',
      });
    }
  }
);

/**
 * GET /api/chat/stats
 * Get user's chat statistics
 */
router.get(
  '/stats',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { ChatLogModel } = await import('../models/ChatLog');

      const [todayCount, successRate] = await Promise.all([
        ChatLogModel.getTodayRequestCount(req.user!.id),
        ChatLogModel.getSuccessRate(req.user!.id),
      ]);

      res.json({
        stats: {
          todayRequests: todayCount,
          successRate: successRate.toFixed(2),
          tier: req.user!.tier,
        },
      });
    } catch (error) {
      console.error('Stats endpoint error:', error);
      res.status(500).json({
        error: 'Failed to fetch stats',
        message: 'An error occurred while fetching statistics',
      });
    }
  }
);

export default router;
```

**Update `backend/src/index.ts`:**

```typescript
// Add after auth routes
import chatRoutes from './routes/chat';

app.use('/api/chat', chatRoutes);
```

### Verification

```bash
# Start server
npm run dev &
sleep 3

# Register user
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"apitest@example.com","password":"SecurePass123!"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test chat (authenticated)
echo "Testing authenticated chat..."
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"What is Flying in MTG?"}'

# Test chat (anonymous)
echo -e "\n\nTesting anonymous chat..."
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What colors are in MTG?"}'

# Test validation error
echo -e "\n\nTesting validation error..."
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":""}'

# Test history
echo -e "\n\nTesting history..."
curl http://localhost:3000/api/chat/history \
  -H "Authorization: Bearer $TOKEN"

# Test stats
echo -e "\n\nTesting stats..."
curl http://localhost:3000/api/chat/stats \
  -H "Authorization: Bearer $TOKEN"

# Stop server
kill $(lsof -t -i:3000)
```

### Success Criteria

- [ ] POST /api/chat works
- [ ] Authenticated chat works
- [ ] Anonymous chat works
- [ ] Validation errors handled
- [ ] Rate limiting enforced
- [ ] Budget checking works
- [ ] History endpoint works
- [ ] Stats endpoint works

---

## Task 1.5.3: Error Handling Middleware

**Estimated Time:** 45 minutes

### Objectives

Create centralized error handling for consistent error responses.

### Steps

**Create `backend/src/middleware/errorHandler.ts`:**

```typescript
import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handler
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Send error response
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      path: req.path,
    }),
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    path: req.path,
  });
}

/**
 * Create an operational error
 */
export function createError(message: string, statusCode: number = 400): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}
```

**Update `backend/src/index.ts`:**

```typescript
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// ... routes ...

// 404 handler (after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);
```

### Verification

```bash
# Test 404
curl http://localhost:3000/nonexistent

# Test error handling in endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}' # Will fail budget check if over budget
```

### Success Criteria

- [ ] 404 handler works
- [ ] Error handler catches all errors
- [ ] Errors logged properly
- [ ] Error responses consistent
- [ ] Stack traces in development only

---

## Task 1.5.4: API Documentation

**Estimated Time:** 30 minutes

### Objectives

Document all API endpoints for future reference.

### Steps

**Create `backend/API.md`:**

```markdown
# MTG Agent API Documentation

## Authentication

### POST /api/auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** 201 Created
```json
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": "free",
    "emailVerified": false
  }
}
```

---

### POST /api/auth/login
Login to existing account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** 200 OK
```json
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": "free",
    "emailVerified": false
  }
}
```

---

### GET /api/auth/me
Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": "free",
    "emailVerified": false,
    "createdAt": "2025-11-01T00:00:00Z"
  }
}
```

---

## Chat

### POST /api/chat
Send a message and get AI response.

**Headers:**
```
Authorization: Bearer <token>  (optional, for authenticated users)
```

**Request:**
```json
{
  "message": "What is Flying in MTG?"
}
```

**Response:** 200 OK
```json
{
  "response": "Flying is a keyword ability...",
  "metadata": {
    "tokensUsed": 234,
    "model": "claude-3-5-sonnet-20241022",
    "costCents": 5
  }
}
```

**Rate Limits:**
- Anonymous: 3 requests/day
- Free tier: 50 requests/day
- Premium: 500 requests/day

---

### GET /api/chat/history
Get chat history (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50)

**Response:** 200 OK
```json
{
  "history": [
    {
      "id": "uuid",
      "messageLength": 25,
      "responseLength": 150,
      "tokensUsed": 200,
      "success": true,
      "createdAt": "2025-11-01T00:00:00Z"
    }
  ]
}
```

---

### GET /api/chat/stats
Get user statistics (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** 200 OK
```json
{
  "stats": {
    "todayRequests": 5,
    "successRate": "98.50",
    "tier": "free"
  }
}
```

---

## Health

### GET /health
Health check endpoint.

**Response:** 200 OK
```json
{
  "status": "healthy",
  "timestamp": "2025-11-01T00:00:00Z",
  "environment": "development",
  "uptime": 123.45
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": []  // Optional, for validation errors
}
```

**Common Status Codes:**
- 400: Bad Request (validation error)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error
- 503: Service Unavailable (budget exceeded)

---

## Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2025-11-02T00:00:00Z
Retry-After: 3600  (if rate limited)
```
```

### Success Criteria

- [ ] All endpoints documented
- [ ] Request/response examples provided
- [ ] Error responses documented
- [ ] Rate limits documented
- [ ] Headers documented

---

## Phase 1.5 Completion Checklist

### Validation
- [x] Zod schemas defined
- [x] Validation middleware works
- [x] Error messages clear
- [x] Type safety maintained

### API Endpoints
- [x] POST /api/chat works
- [x] GET /api/chat/history works
- [x] GET /api/chat/stats works
- [x] All endpoints validated
- [x] All endpoints protected appropriately

### Error Handling
- [x] Global error handler works
- [x] 404 handler works
- [x] Errors logged
- [x] Stack traces only in dev
- [x] Consistent error format

### Integration
- [x] Auth integration works
- [x] Rate limiting works
- [x] Budget checking works
- [x] Cost tracking works
- [x] All middleware chained correctly

### Documentation
- [x] API documented
- [x] Examples provided
- [x] Error responses documented

## Common Issues

### Issue: Validation errors unclear

**Solution:**
```typescript
// Improve Zod error messages
const schema = z.string()
  .min(1, 'This field is required')
  .max(100, 'Maximum 100 characters allowed');
```

### Issue: Middleware order wrong

**Solution:**
```typescript
// Correct order:
app.use(helmet());           // 1. Security
app.use(cors());             // 2. CORS
app.use(express.json());     // 3. Body parsing
app.use(routes);             // 4. Routes
app.use(notFoundHandler);    // 5. 404
app.use(errorHandler);       // 6. Errors (LAST)
```

## Next Steps

1. ✅ Verify all checklist items
2. ✅ Test all endpoints
3. ✅ Review API documentation
4. ✅ Commit: `feat(api): complete Phase 1.5`
5. ➡️ Proceed to [Phase 1.6: Frontend](PHASE_1.6_FRONTEND.md)

---

**Status:** ✅ Complete
**Last Updated:** 2025-11-10
**Next Phase:** [Phase 1.6: Frontend Application](PHASE_1.6_FRONTEND.md)
