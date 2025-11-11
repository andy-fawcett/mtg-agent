# MTG Agent API Documentation

## Base URL

```
http://localhost:3000
```

## Authentication

The API uses session-based authentication with HttpOnly cookies. After successful registration or login, a session cookie is automatically set.

---

## Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Validation:**
- Email: Valid email format, max 255 characters
- Password: Minimum 12 characters, max 128 characters

**Response:** 201 Created

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": "free",
    "emailVerified": false
  }
}
```

**Error Responses:**
- 400: Validation failed or email already registered
- 500: Registration failed

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
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": "free",
    "emailVerified": false
  }
}
```

**Error Responses:**
- 400: Invalid credentials
- 500: Login failed

---

### POST /api/auth/logout

Logout current user (destroys session).

**Authentication:** Required

**Response:** 200 OK

```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/auth/me

Get current user information.

**Authentication:** Required

**Response:** 200 OK

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": "free",
    "emailVerified": false,
    "createdAt": "2025-11-10T00:00:00Z"
  }
}
```

**Error Responses:**
- 401: Not authenticated

---

## Chat Endpoints

### POST /api/chat

Send a message and get AI response.

**Authentication:** Optional (authenticated users have higher rate limits)

**Request:**

```json
{
  "message": "What is Flying in MTG?"
}
```

**Validation:**
- Message: After trimming whitespace, must be 1-4000 characters

**Response:** 200 OK

```json
{
  "response": "Flying is a keyword ability in Magic: The Gathering...",
  "metadata": {
    "tokensUsed": 234,
    "model": "claude-sonnet-4-5-20250929",
    "costCents": 1
  }
}
```

**Rate Limits:**
- Anonymous: 3 requests/day
- Free tier: 50 requests/day
- Premium: 500 requests/day
- IP-based: 10 requests/minute

**Error Responses:**
- 400: Validation failed or invalid request detected (jailbreak attempt)
- 429: Rate limit exceeded
- 503: Daily budget exceeded

**Rate Limit Headers:**
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 49
X-RateLimit-Reset: 2025-11-11T00:00:00Z
Retry-After: 3600  (if rate limited)
```

---

### GET /api/chat/history

Get user's chat history.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50, max: 100)

**Example:**
```
GET /api/chat/history?limit=20
```

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
      "createdAt": "2025-11-10T12:00:00Z"
    }
  ]
}
```

**Error Responses:**
- 401: Not authenticated
- 500: Failed to fetch history

**Note:** Full message content is not returned for privacy. Only metadata is provided.

---

### GET /api/chat/stats

Get user's chat statistics.

**Authentication:** Required

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

**Error Responses:**
- 401: Not authenticated
- 500: Failed to fetch stats

---

## Health & Info Endpoints

### GET /health

Health check endpoint.

**Response:** 200 OK

```json
{
  "status": "healthy",
  "timestamp": "2025-11-10T12:00:00Z",
  "environment": "development",
  "uptime": 123.45
}
```

---

### GET /

API information endpoint.

**Response:** 200 OK

```json
{
  "name": "MTG Agent API",
  "version": "1.0.0",
  "status": "running",
  "documentation": "/api/docs"
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

### Common Status Codes

- **400 Bad Request**: Validation error or invalid input
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions (e.g., tier restrictions)
- **404 Not Found**: Route does not exist
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Budget exceeded or service temporarily down

### Validation Errors

Validation errors include a `details` array with specific field errors:

```json
{
  "error": "Validation failed",
  "message": "Invalid request data",
  "details": [
    {
      "field": "message",
      "message": "Message cannot be empty"
    },
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

## Rate Limiting

### Rate Limit Tiers

| Tier | Daily Limit | Max Tokens/Request | IP Limit |
|------|-------------|-------------------|----------|
| Anonymous | 3/day | 1000 | 10/min |
| Free | 50/day | 2000 | 10/min |
| Premium | 500/day | 4000 | 10/min |

### Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 50          # Total limit for your tier
X-RateLimit-Remaining: 45      # Remaining requests
X-RateLimit-Reset: <timestamp> # When limit resets (ISO 8601)
```

When rate limited, you'll also receive:

```
Retry-After: 3600  # Seconds until you can retry
```

### Budget Controls

Daily budget caps prevent overspending:
- Anonymous: $0.10/day
- Free: $1.00/day
- Premium: $10.00/day

When budget is exceeded, you'll receive a 503 error:

```json
{
  "error": "Service unavailable",
  "message": "Daily budget exceeded. Try again tomorrow."
}
```

---

## Security Features

### Input Validation

All inputs are validated using Zod schemas:
- Email format validation
- Password strength requirements (12+ chars)
- Message length limits (4000 chars)
- Automatic whitespace trimming

### Jailbreak Detection

The system detects and blocks attempts to:
- Override system instructions
- Extract system prompts
- Modify AI behavior
- Inject malicious instructions

Blocked requests return:

```json
{
  "error": "Invalid request",
  "message": "Your message contains disallowed content"
}
```

### Output Sanitization

All AI responses are sanitized to:
- Remove potential XSS attacks
- Strip system prompt leakage
- Enforce length limits

### Session Security

- HttpOnly cookies (not accessible via JavaScript)
- Secure flag in production (HTTPS only)
- SameSite=Strict (CSRF protection)
- Session expiration after inactivity

---

## Example Usage

### Complete Flow Example

```bash
# 1. Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"user@example.com","password":"SecurePassword123!"}'

# 2. Send a chat message (authenticated)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"message":"What is Flying in MTG?"}'

# 3. Get chat history
curl http://localhost:3000/api/chat/history \
  -b cookies.txt

# 4. Get stats
curl http://localhost:3000/api/chat/stats \
  -b cookies.txt

# 5. Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

### Anonymous Chat Example

```bash
# Send a message without authentication
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What are the 5 colors in MTG?"}'
```

**Note:** Anonymous users are limited to 3 requests per day.

---

## Development vs Production

### Development Mode

- Stack traces included in error responses
- Detailed logging to console
- CORS enabled for localhost:3001
- Rate limits enforced but generous

### Production Mode

- Generic error messages only
- Structured logging to files
- Restricted CORS origins
- Strict rate limits and budget controls

---

## Support

For issues or questions:
- GitHub Issues: [Project Repository]
- Documentation: See `docs/` directory

---

**Last Updated:** 2025-11-10
**API Version:** 1.0.0
**Status:** Phase 1.5 Complete
