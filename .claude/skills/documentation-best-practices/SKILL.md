---
name: documentation-best-practices
description: This skill should be used when creating or updating implementation documentation, task breakdowns, verification steps, or phase planning documents. It provides standards and templates for consistent, professional documentation throughout the MTG Agent project.
---

# Documentation Best Practices

This skill provides guidance for creating consistent, professional documentation for the MTG Agent project implementation.

## Purpose

Maintain high-quality, actionable documentation that follows senior developer standards with:
- Clear task breakdowns with time estimates
- Comprehensive verification steps
- Rollback procedures for safety
- Testing integrated throughout
- Professional commit messages

## When to Use This Skill

Use this skill when:
- Creating new phase documentation
- Writing task breakdowns for implementation
- Documenting verification procedures
- Setting up testing requirements
- Creating progress tracking documents
- Writing commit messages
- Updating implementation plans

## Documentation Structure Standards

### Phase README Format

Each phase README should include:

1. **Phase Overview**
   - Phase number and name
   - Status (Not Started, In Progress, Completed)
   - Duration estimate
   - Prerequisites

2. **Objectives**
   - Clear, measurable goals
   - 3-5 bullet points max
   - Specific deliverables

3. **Why This Phase**
   - Business/technical justification
   - Dependencies explained
   - Risk mitigation

4. **Sub-Phases**
   - List of sub-phases with brief descriptions
   - Estimated time for each
   - Dependencies between sub-phases

5. **Success Criteria**
   - Checklist of completion requirements
   - Verification that phase is truly done
   - Performance targets if applicable

6. **Next Phase**
   - Link to next phase
   - What will be built upon

### Task Documentation Format

Each task should include:

1. **Task Header**
   ```markdown
   ### Task X.Y: [Clear Task Name]
   **Estimated Time:** X minutes/hours
   **Prerequisites:** [What must be done first]
   ```

2. **Objectives**
   - What this task accomplishes
   - Why it's necessary

3. **Steps**
   - Numbered, specific steps
   - Include commands to run
   - Code examples where applicable
   - File paths clearly stated

4. **Verification**
   ```markdown
   **Verification:**
   ```bash
   # Commands to verify task completion
   command1
   command2
   ```

   **Expected Output:**
   - What success looks like
   ```

5. **Success Criteria**
   ```markdown
   - [ ] Specific criterion 1
   - [ ] Specific criterion 2
   - [ ] Specific criterion 3
   ```

6. **Common Issues**
   - Known problems and solutions
   - Troubleshooting steps

### Code Examples

To include code examples:

**For Configuration Files:**
````markdown
**Create:** `path/to/file.ext`

```language
// Full file content here
// With comments explaining key parts
```
````

**For Commands:**
````markdown
```bash
# Comment explaining what this does
command --flag value
```
````

**For Multi-Step Procedures:**
````markdown
```bash
# Step 1: Setup
command1

# Step 2: Execute
command2

# Step 3: Verify
command3
```
````

### Verification Steps Format

Every task must include verification:

```markdown
**Verification:**
```bash
# Test command 1
curl http://localhost:3000/health

# Test command 2
npm test

# Test command 3
docker-compose ps
```

**Expected Output:**
- Service returns 200 OK
- All tests pass
- All containers running

**Success Criteria:**
- [ ] Command 1 passes
- [ ] Command 2 passes
- [ ] Command 3 passes
```

### Rollback Procedures

Include rollback steps for safety:

```markdown
## Rollback Procedure

If this task causes issues:

```bash
# Step 1: Stop services
docker-compose down

# Step 2: Restore from backup
git checkout <previous-commit>

# Step 3: Restart
docker-compose up -d
```

**When to Rollback:**
- Verification fails repeatedly
- Breaks existing functionality
- Introduces security vulnerability
```

## Commit Message Standards

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Build process, dependencies

**Examples:**
```
feat(auth): add JWT authentication middleware

Implement JWT-based authentication with bcrypt password hashing.
Includes middleware for protected routes and token validation.

- Add bcrypt password hashing
- Create JWT generation utility
- Implement auth middleware
- Add tests for auth flow

Closes #123
```

```
fix(rate-limit): correct Redis connection leak

Fixed issue where Redis connections weren't properly closed,
causing connection pool exhaustion under load.

- Close Redis connections in finally block
- Add connection pool monitoring
- Update tests to verify cleanup
```

```
docs(phase1): add database setup documentation

Created comprehensive documentation for Phase 1.1 database setup
including schema, migrations, and verification steps.
```

## Progress Tracking

### Task Status

Use clear status indicators:
- ⏸️ Not Started
- 🔄 In Progress
- ✅ Completed
- ❌ Blocked
- ⚠️ Needs Review

### Update Frequency

Update documentation:
- ✅ Before starting a task (mark in progress)
- ✅ Immediately after completing task (mark complete)
- ✅ When blocked (document blocker)
- ✅ When requirements change

### Completion Checklist

Mark tasks complete only when:
- [ ] All code written and committed
- [ ] All verification steps pass
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Code reviewed (if applicable)
- [ ] No known issues

## Testing Integration

### Test Documentation Standard

For each phase/task, document:

```markdown
## Testing Requirements

### Unit Tests
- [ ] Test X functionality
- [ ] Test Y edge case
- [ ] Test Z error handling

### Integration Tests
- [ ] Test A to B integration
- [ ] Test error scenarios
- [ ] Test performance

### Manual Verification
```bash
# Command to verify manually
test-command
```

**Expected Behavior:**
- Specific outcome 1
- Specific outcome 2
```

### Test-First Approach

When possible:
1. Write verification steps BEFORE implementation
2. Run verification (should fail initially)
3. Implement feature
4. Run verification (should pass)
5. Document results

## Documentation Maintenance

### Keep Documentation Current

- Update docs in same commit as code changes
- Document decisions and rationale
- Note workarounds and TODOs
- Link related documents

### Review and Refactor

Periodically review documentation for:
- Outdated information
- Broken links
- Unclear instructions
- Missing verification steps

## Templates Usage

To use the bundled templates:

1. **Task Documentation:** See `references/task-template.md`
2. **Verification Steps:** See `references/verification-template.md`
3. **Phase README:** See `assets/phase-readme-template.md`

Load these references as needed when creating new documentation.

## Best Practices Summary

✅ **DO:**
- Write clear, specific steps
- Include time estimates
- Provide verification commands
- Document expected outputs
- Include rollback procedures
- Write tests alongside code
- Update docs with code changes
- Use consistent formatting

❌ **DON'T:**
- Leave verification steps vague
- Skip rollback procedures
- Document without testing
- Mix multiple concerns in one task
- Forget to update status
- Omit time estimates
- Skip commit message body

## Examples

See bundled references for complete examples of:
- Task documentation with full verification
- Phase README with comprehensive breakdown
- Verification step templates
