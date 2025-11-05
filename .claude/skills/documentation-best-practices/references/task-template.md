# Task Documentation Template

Use this template when documenting individual tasks within a phase.

## Template

```markdown
### Task X.Y: [Descriptive Task Name]
**Estimated Time:** X minutes/hours
**Prerequisites:** [List prerequisites or "None"]

## Objectives

Clear description of what this task accomplishes and why it's necessary.

- Specific objective 1
- Specific objective 2
- Specific objective 3

## Steps

### Step 1: [First Action]

**Description:** What this step does and why.

```bash
# Commands to execute
command1 --flag value
command2
```

**Explanation:**
- What command1 does
- What command2 does
- Why these are necessary

### Step 2: [Second Action]

**Create:** `path/to/file.ext`

```typescript
// Code example with comments
export function exampleFunction() {
  // Implementation
}
```

**Key Points:**
- Explain important parts
- Note any gotchas
- Reference best practices

### Step 3: [Third Action]

Continue with numbered steps...

## Verification

Test that the task was completed correctly:

```bash
# Test 1: Description of what this tests
test-command-1

# Test 2: Description
test-command-2

# Test 3: Description
test-command-3
```

**Expected Output:**
```
Expected output from test-command-1
```

**Success Indicators:**
- Specific indicator 1
- Specific indicator 2
- Specific indicator 3

## Success Criteria

- [ ] All steps completed without errors
- [ ] All verification tests pass
- [ ] Expected output matches actual output
- [ ] No new warnings or errors in logs
- [ ] Related functionality still works
- [ ] Documentation updated

## Common Issues

### Issue: [Problem Description]

**Symptoms:**
- How this manifests
- Error messages

**Solution:**
```bash
# Commands to fix
fix-command
```

**Explanation:** Why this happens and how the fix works.

### Issue: [Another Problem]

**Symptoms:**
- Symptom 1
- Symptom 2

**Solution:**
```bash
# Fix commands
fix-command
```

## Rollback Procedure

If this task causes problems:

```bash
# Step 1: Stop affected services
stop-command

# Step 2: Revert changes
git checkout HEAD~1 path/to/changed/files

# Step 3: Restart services
start-command
```

**When to Rollback:**
- Verification fails after multiple attempts
- Breaks existing functionality
- Introduces security issues
- Causes performance degradation

## Related Documentation

- Link to related task
- Link to relevant architecture doc
- Link to external resource

---

**Status:** ⏸️ Not Started | 🔄 In Progress | ✅ Completed
**Last Updated:** YYYY-MM-DD
```

## Example Usage

```markdown
### Task 1.1: Initialize PostgreSQL Database Schema
**Estimated Time:** 20 minutes
**Prerequisites:** Docker Compose running, PostgreSQL container healthy

## Objectives

Create the initial database schema for user management and authentication.

- Create users table with proper constraints
- Create indexes for performance
- Set up database migration system
- Verify schema is correctly applied

## Steps

### Step 1: Create Migration Directory

```bash
mkdir -p backend/migrations
touch backend/migrations/001_initial_schema.sql
```

### Step 2: Define Users Table Schema

**Create:** `backend/migrations/001_initial_schema.sql`

```sql
-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  tier VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Index for tier queries
CREATE INDEX idx_users_tier ON users(tier);
```

**Key Points:**
- UUID for secure, non-sequential IDs
- email must be unique and not null
- tier defaults to 'free' for new users
- Indexes on frequently queried columns

### Step 3: Run Migration

```bash
# Apply migration
psql $DATABASE_URL -f backend/migrations/001_initial_schema.sql

# Verify tables created
psql $DATABASE_URL -c "\dt"
```

## Verification

```bash
# Test 1: Verify users table exists
psql $DATABASE_URL -c "\d users"

# Test 2: Verify indexes created
psql $DATABASE_URL -c "\di"

# Test 3: Insert test user
psql $DATABASE_URL -c "INSERT INTO users (email, password_hash) VALUES ('test@example.com', 'hash123') RETURNING *;"

# Test 4: Verify constraints work
psql $DATABASE_URL -c "INSERT INTO users (email, password_hash) VALUES ('test@example.com', 'hash456');"
# Should fail with unique constraint error
```

**Expected Output:**
```
# From Test 1:
Table "public.users"
   Column      |  Type   | Modifiers
---------------+---------+-----------
 id            | uuid    | not null
 email         | varchar | not null
 ...

# From Test 3:
INSERT 0 1
Returning: (uuid, test@example.com, hash123, free, timestamp, timestamp)

# From Test 4:
ERROR:  duplicate key value violates unique constraint "users_email_key"
```

**Success Indicators:**
- users table exists with all columns
- Indexes created successfully
- Can insert valid users
- Unique constraint prevents duplicate emails

## Success Criteria

- [ ] Migration file created and documented
- [ ] Users table exists with correct schema
- [ ] All indexes created
- [ ] Can insert users successfully
- [ ] Constraints work as expected
- [ ] No errors in PostgreSQL logs

## Common Issues

### Issue: "relation already exists" error

**Symptoms:**
- Migration fails with table already exists

**Solution:**
```bash
# Drop existing table (CAUTION: only in development)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS users CASCADE;"

# Re-run migration
psql $DATABASE_URL -f backend/migrations/001_initial_schema.sql
```

**Explanation:** Table wasn't cleaned up from previous test. Use IF NOT EXISTS in production.

### Issue: Cannot connect to database

**Symptoms:**
- psql command fails
- Connection refused error

**Solution:**
```bash
# Check Docker container is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Verify connection
psql $DATABASE_URL -c "SELECT 1;"
```

## Rollback Procedure

```bash
# Step 1: Drop the created table
psql $DATABASE_URL -c "DROP TABLE IF EXISTS users CASCADE;"

# Step 2: Remove migration file
rm backend/migrations/001_initial_schema.sql

# Step 3: Verify clean state
psql $DATABASE_URL -c "\dt"
```

**When to Rollback:**
- Schema is incorrect and needs redesign
- Migration causes performance issues
- Breaking existing functionality

## Related Documentation

- [Database Architecture](../../docs/BACKEND_ARCHITECTURE.md#database-schema)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/current/ddl-constraints.html)

---

**Status:** ✅ Completed
**Last Updated:** 2025-11-01
```

## Tips for Using This Template

1. **Copy the entire template** for each new task
2. **Fill in all sections** - don't skip verification or rollback
3. **Test your commands** before documenting them
4. **Include actual output** in expected output section
5. **Update status** as you progress
6. **Be specific** - avoid vague instructions
7. **Add time estimates** based on actual time taken
8. **Document as you go** - don't wait until the end
