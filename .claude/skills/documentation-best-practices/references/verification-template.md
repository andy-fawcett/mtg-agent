# Verification Steps Template

Use this template to create comprehensive verification procedures for any task or feature.

## Template

```markdown
## Verification

### Automated Verification

```bash
# ===== Unit Tests =====
# Description: Test individual functions in isolation
npm test path/to/test/file.test.ts

# ===== Integration Tests =====
# Description: Test component interactions
npm run test:integration

# ===== Linting =====
# Description: Check code quality and style
npm run lint

# ===== Type Checking =====
# Description: Verify TypeScript types
npx tsc --noEmit
```

### Manual Verification

```bash
# ===== Service Health Check =====
# Description: Verify service is running
curl -f http://localhost:3000/health
# Expected: {"status":"healthy"}

# ===== Database Connection =====
# Description: Test database connectivity
psql $DATABASE_URL -c "SELECT 1 as test;"
# Expected: test
#          -----
#           1

# ===== Redis Connection =====
# Description: Test cache connectivity
redis-cli ping
# Expected: PONG

# ===== Feature-Specific Test =====
# Description: Test the specific functionality added
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'
# Expected: {"success":true,"result":"..."}
```

### Security Verification

```bash
# ===== Check for exposed secrets =====
git log --all -S "sk-ant-" --oneline
# Expected: (empty - no API keys in history)

# ===== Verify environment variables =====
node -e "require('dotenv').config(); console.log(!!process.env.ANTHROPIC_API_KEY)"
# Expected: true

# ===== Check file permissions =====
ls -la .env
# Expected: -rw------- (owner read/write only)

# ===== Verify .gitignore =====
git check-ignore .env
# Expected: .env
```

### Performance Verification

```bash
# ===== Response Time Check =====
# Description: Verify acceptable response times
time curl http://localhost:3000/api/endpoint
# Expected: real < 2.0s

# ===== Load Test =====
# Description: Test under concurrent load
ab -n 100 -c 10 http://localhost:3000/health
# Expected: All requests succeed, avg response < 200ms

# ===== Memory Usage =====
# Description: Check for memory leaks
docker stats --no-stream mtg-agent-backend
# Expected: Memory < 512MB
```

## Expected Outcomes

### Success Indicators

- [ ] All automated tests pass
- [ ] Manual tests return expected results
- [ ] No security vulnerabilities detected
- [ ] Performance within acceptable limits
- [ ] No errors in logs
- [ ] No warnings from linter
- [ ] TypeScript compiles without errors
- [ ] All services respond to health checks
- [ ] Database queries execute successfully
- [ ] API endpoints return correct status codes

### Expected Logs

```
[INFO] Server started on port 3000
[INFO] Database connected successfully
[INFO] Redis connected
[INFO] Health check: OK
```

### Expected Errors (None)

No errors should appear in logs. If any errors occur:
1. Document the error message
2. Investigate root cause
3. Fix before marking complete
4. Re-run all verification steps

## Failure Scenarios

### What to Check If Verification Fails

1. **Service Won't Start**
   ```bash
   # Check logs
   docker-compose logs backend

   # Check port conflicts
   lsof -i :3000

   # Verify environment variables
   cat .env | grep -v "^#"
   ```

2. **Database Connection Fails**
   ```bash
   # Check container status
   docker-compose ps postgres

   # View logs
   docker-compose logs postgres

   # Test connection manually
   psql $DATABASE_URL -c "SELECT version();"
   ```

3. **Tests Fail**
   ```bash
   # Run tests with verbose output
   npm test -- --verbose

   # Run specific failing test
   npm test -- path/to/failing.test.ts

   # Check test database state
   npm run test:db:reset
   ```

4. **Performance Issues**
   ```bash
   # Profile the endpoint
   curl -w "@curl-format.txt" http://localhost:3000/api/endpoint

   # Check database query performance
   psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM users LIMIT 100;"

   # Monitor resource usage
   docker stats
   ```

## Verification Checklist

Use this checklist for every task:

### Pre-Verification
- [ ] All code written and saved
- [ ] Code formatted (npm run format)
- [ ] No console.log statements left
- [ ] Comments added for complex logic
- [ ] Environment variables set

### Automated Checks
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Linter passes
- [ ] TypeScript compiles
- [ ] No security warnings

### Manual Checks
- [ ] Health endpoints respond
- [ ] Database queries work
- [ ] Redis/cache works
- [ ] API endpoints functional
- [ ] Error handling works

### Security Checks
- [ ] No secrets in code
- [ ] .env not in Git
- [ ] Proper file permissions
- [ ] Input validation working
- [ ] Output sanitization working

### Performance Checks
- [ ] Response times acceptable
- [ ] Memory usage reasonable
- [ ] No connection leaks
- [ ] Database queries optimized

### Documentation Checks
- [ ] README updated if needed
- [ ] API docs updated
- [ ] Inline comments added
- [ ] Verification steps documented

## Recording Results

### Success
```markdown
**Verification Results:** ✅ Passed

All automated and manual tests passed on first attempt.

- Unit tests: 45/45 passed
- Integration tests: 12/12 passed
- Manual tests: All endpoints responding correctly
- Security: No issues detected
- Performance: Avg response 145ms

**Verified By:** [Your Name]
**Date:** 2025-11-01
**Time Taken:** ~5 minutes
```

### Partial Success (Fixed Issues)
```markdown
**Verification Results:** ⚠️ Passed with fixes

Initial verification found issues, resolved before completion.

**Issues Found:**
1. TypeScript error in auth.ts:45 - fixed missing type annotation
2. Unit test failing - fixed mock data format
3. Port 3000 in use - changed to 3001 temporarily

**After Fixes:**
- All tests passing
- All manual verification successful

**Verified By:** [Your Name]
**Date:** 2025-11-01
**Time Taken:** ~15 minutes (including fixes)
```

### Failure
```markdown
**Verification Results:** ❌ Failed

Verification failed due to [specific reason].

**Failures:**
1. Database migration fails with constraint error
2. Auth tests timing out
3. Performance below acceptable threshold

**Next Steps:**
1. Rollback database changes
2. Investigate auth timeout
3. Profile slow endpoint
4. Re-verify after fixes

**Status:** Blocked
**Blocked By:** Database schema issue
**Estimated Fix Time:** 1 hour
```

## Tips for Effective Verification

1. **Run verification frequently** - After each significant change
2. **Test in isolation** - Verify new feature doesn't break old ones
3. **Document edge cases** - Test boundary conditions
4. **Verify rollback** - Ensure rollback procedure actually works
5. **Check error scenarios** - Test failure paths, not just success
6. **Performance test** - Don't assume it's fast, measure it
7. **Security first** - Always verify secrets aren't exposed
8. **Fresh environment** - Occasionally test on clean Docker containers
9. **Actual data** - Test with realistic data sizes
10. **Cross-browser** - For frontend, test in multiple browsers
```

## Example: Complete Verification for Auth Feature

```markdown
## Verification - JWT Authentication Implementation

### Automated Verification

```bash
# Unit tests
npm test src/middleware/auth.test.ts
# Result: ✅ 15/15 tests passed

# Integration tests
npm test tests/integration/auth.test.ts
# Result: ✅ 8/8 tests passed

# Type checking
npx tsc --noEmit
# Result: ✅ No errors

# Linting
npm run lint src/middleware/auth.ts
# Result: ✅ No issues
```

### Manual Verification

```bash
# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
# Expected: {"token":"eyJ...", "user":{"id":"...","email":"test@example.com"}}
# Actual: ✅ Matches expected

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
# Expected: {"token":"eyJ...","user":{...}}
# Actual: ✅ Matches expected

# Test protected route without token
curl http://localhost:3000/api/protected
# Expected: 401 Unauthorized
# Actual: ✅ 401 {"error":"No token provided"}

# Test protected route with token
curl http://localhost:3000/api/protected \
  -H "Authorization: Bearer eyJ..."
# Expected: 200 with protected data
# Actual: ✅ 200 {"message":"Access granted"}

# Test with invalid token
curl http://localhost:3000/api/protected \
  -H "Authorization: Bearer invalid-token"
# Expected: 403 Forbidden
# Actual: ✅ 403 {"error":"Invalid token"}
```

### Security Verification

```bash
# Verify passwords are hashed
psql $DATABASE_URL -c "SELECT password_hash FROM users LIMIT 1;"
# Expected: Bcrypt hash starting with $2b$
# Actual: ✅ $2b$12$...

# Verify JWT secret is loaded
node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET.length)"
# Expected: 64 (32 bytes in hex)
# Actual: ✅ 64

# Check for hardcoded secrets
grep -r "jwt_secret\|password" src/ --exclude="*.test.ts"
# Expected: Only environment variable references
# Actual: ✅ No hardcoded secrets found
```

### Performance Verification

```bash
# Test response time
time curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
# Expected: < 500ms
# Actual: ✅ 0.234s (234ms)

# Load test
ab -n 1000 -c 10 -p login.json -T application/json \
  http://localhost:3000/api/auth/login
# Expected: > 95% success rate, avg < 500ms
# Actual: ✅ 100% success, avg 187ms
```

### Verification Results

**Overall Status:** ✅ PASSED

**Summary:**
- All automated tests passed (23/23)
- All manual verification successful
- Security checks passed
- Performance within targets
- No errors in logs

**Metrics:**
- Test coverage: 94%
- Response time (avg): 187ms
- Success rate: 100%
- Memory usage: 45MB

**Verified By:** Developer Name
**Date:** 2025-11-01 15:30 UTC
**Duration:** 8 minutes

**Ready for:** Phase 1.3 (Rate Limiting)
```
