# Contributing to MTG Agent

Thank you for your interest in contributing to MTG Agent! This document provides guidelines and standards for contributions.

---

## 🎯 Project Philosophy

- **Security First:** All contributions must maintain or improve security
- **Quality Over Speed:** Better to do it right than do it fast
- **Type Safety:** TypeScript strict mode, no exceptions
- **Test Coverage:** 70%+ coverage required
- **Documentation:** Code changes require documentation updates

---

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:
- Node.js 20+ installed
- pnpm 10+ (NOT npm) - see [NPM Security Guide](reference/NPM_SECURITY.md)
- Docker Desktop running
- Git configured

### Setup

```bash
# Fork and clone repository
git clone https://github.com/YOUR_USERNAME/mtg-agent.git
cd mtg-agent

# Read critical documentation
cat docs/reference/NPM_SECURITY.md
cat docs/reference/SECURITY_ARCHITECTURE.md

# Check project status
cat STATUS.md

# Install dependencies (use pnpm!)
cd backend
pnpm install
```

---

## 📝 Contribution Types

### 1. Bug Fixes

**Process:**
1. Check if issue already exists
2. Create issue if not exists (include reproduction steps)
3. Fork repository
4. Create branch: `fix/short-description`
5. Fix bug with tests
6. Submit pull request

**Requirements:**
- Include test that would have caught the bug
- Update documentation if behavior changes
- Reference issue number in commit message

---

### 2. New Features

**Process:**
1. Discuss feature in an issue first (avoid wasted work)
2. Get approval from maintainers
3. Create branch: `feature/short-description`
4. Implement feature following standards
5. Add comprehensive tests
6. Update documentation
7. Submit pull request

**Requirements:**
- Tests for happy path and edge cases
- Performance considerations documented
- Security implications reviewed
- User-facing changes documented

---

### 3. Documentation Improvements

**Process:**
1. Create branch: `docs/short-description`
2. Make improvements
3. Verify all links work
4. Submit pull request

**Requirements:**
- Clear, concise writing
- Code examples tested
- Consistent formatting
- Updated table of contents if needed

---

### 4. Security Fixes

**⚠️ SPECIAL PROCESS:**

**DO NOT** create public issues for security vulnerabilities!

Instead:
1. Email security concerns to [SECURITY_EMAIL]
2. Provide details privately
3. Allow time for fix before disclosure

---

## 🔐 Security Requirements

All contributions MUST follow these security rules:

### Critical Rules

1. **API Keys:**
   - ❌ NEVER commit API keys
   - ❌ NEVER import `@anthropic-ai/sdk` in frontend
   - ✅ Keep all keys backend-side only

2. **Package Manager:**
   - ❌ NEVER use `npm install`
   - ✅ ALWAYS use `pnpm install`

3. **Input Validation:**
   - ✅ ALWAYS validate user input with Zod
   - ✅ ALWAYS sanitize outputs
   - ✅ ALWAYS use parameterized SQL queries

4. **Authentication:**
   - ✅ ALWAYS hash passwords with bcrypt (cost 12+)
   - ✅ ALWAYS use strong JWT secrets (64+ chars)
   - ❌ NEVER store passwords in plaintext

5. **Error Handling:**
   - ✅ Generic error messages in production
   - ❌ NEVER expose stack traces in production
   - ❌ NEVER leak sensitive info in errors

### Security Checklist

Before submitting, verify:
- [ ] No API keys in code or commits
- [ ] No hardcoded secrets
- [ ] All inputs validated
- [ ] SQL queries parameterized
- [ ] Passwords properly hashed
- [ ] Error messages don't leak info
- [ ] Used pnpm (not npm)

---

## 💻 Coding Standards

### TypeScript

**Strict Mode Required:**
```typescript
// ✅ CORRECT
export function calculateCost(tokens: number): number {
  return (tokens / 1000) * 0.003;
}

// ❌ WRONG - Implicit any
export function calculateCost(tokens) {
  return (tokens / 1000) * 0.003;
}
```

**No `any` Types:**
```typescript
// ✅ CORRECT
function processData(data: unknown): ProcessedData {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid data');
  }
  // Type narrowing...
}

// ❌ WRONG
function processData(data: any): ProcessedData {
  return data.something;
}
```

**Return Types Required:**
```typescript
// ✅ CORRECT
export async function createUser(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  // Implementation
}

// ❌ WRONG - No return type
export async function createUser(email, password) {
  // Implementation
}
```

### Naming Conventions

- **Variables/Functions:** camelCase
- **Classes/Interfaces:** PascalCase
- **Constants:** UPPER_SNAKE_CASE
- **Files:** kebab-case
- **Database Tables:** snake_case

### Comments

```typescript
// ✅ CORRECT - Explain WHY
// Use cost factor 12 to balance security and performance.
// Lower values vulnerable to GPU attacks, higher impact UX.
const hash = await bcrypt.hash(password, 12);

// ❌ WRONG - Explain WHAT
// Hash the password with bcrypt
const hash = await bcrypt.hash(password, 12);
```

Full standards: [Development Best Practices](reference/DEVELOPMENT_BEST_PRACTICES.md)

---

## 🧪 Testing Requirements

### Coverage Target: 70%+

**What to Test:**
- All public functions
- Authentication logic
- Input validation
- Database operations
- API endpoints
- Error handling

**Test Structure:**
```typescript
describe('Feature', () => {
  describe('specificFunction', () => {
    it('should handle happy path', () => {
      // Test normal case
    });

    it('should handle edge case X', () => {
      // Test edge case
    });

    it('should throw on invalid input', () => {
      // Test error case
    });
  });
});
```

**Running Tests:**
```bash
# All tests
pnpm test

# With coverage
pnpm run test:coverage

# Watch mode
pnpm test --watch
```

---

## 📋 Pull Request Process

### Before Submitting

1. **Update your branch:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks:**
   ```bash
   pnpm run type-check  # TypeScript
   pnpm run lint        # Linting
   pnpm test            # Tests
   pnpm audit           # Security
   ```

3. **Update documentation:**
   - Code comments
   - API documentation
   - README if needed
   - Phase docs if implementing from plan

4. **Security scan:**
   ```bash
   # No API keys exposed
   grep -r "sk-ant-" . --exclude-dir=node_modules

   # .env not committed
   git status | grep .env
   ```

### Pull Request Template

```markdown
## Description
[Clear description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Closes #[issue number]

## Changes Made
- [Change 1]
- [Change 2]

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing
- [ ] Coverage >70%

## Security
- [ ] No API keys exposed
- [ ] Input validation added
- [ ] SQL injection prevented
- [ ] Used pnpm (not npm)
- [ ] Security scan passed

## Documentation
- [ ] Code comments updated
- [ ] README updated (if needed)
- [ ] API docs updated (if needed)
- [ ] Phase docs updated (if implementing)

## Checklist
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] Tests pass
- [ ] No merge conflicts
- [ ] Commit messages descriptive
- [ ] Branch up to date with main
```

### Review Process

1. **Automated checks:** CI runs tests and linting
2. **Security review:** Automated security scan
3. **Code review:** Maintainer reviews code
4. **Changes requested:** Address feedback
5. **Approval:** PR approved
6. **Merge:** Maintainer merges PR

---

## 📐 Commit Message Format

### Structure

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes
- `security`: Security fixes

### Examples

```bash
# Feature
git commit -m "feat(auth): add JWT token refresh endpoint

Implements token refresh to allow users to stay logged in.
Tokens expire after 7 days but can be refreshed.

Closes #123"

# Bug fix
git commit -m "fix(rate-limit): correct Redis key expiration

Rate limit keys were not expiring correctly, causing
limits to persist longer than intended.

Fixes #456"

# Documentation
git commit -m "docs(readme): add pnpm installation instructions

Added clear instructions for installing and using pnpm
instead of npm for better security."
```

---

## 🌳 Branch Strategy

### Branch Naming

- `feature/short-description` - New features
- `fix/short-description` - Bug fixes
- `docs/short-description` - Documentation
- `refactor/short-description` - Code refactoring
- `test/short-description` - Test additions/changes

### Main Branches

- `main` - Production-ready code
- Feature branches - Work in progress

### Workflow

```bash
# Create feature branch
git checkout -b feature/add-deck-analysis

# Make changes and commit
git add .
git commit -m "feat(mtg): add deck analysis endpoint"

# Push to your fork
git push origin feature/add-deck-analysis

# Create pull request on GitHub
```

---

## 📊 Performance Guidelines

### Database Queries

- Use indexes for frequently queried fields
- Limit query results (pagination)
- Use connection pooling
- Cache expensive queries in Redis

### API Responses

- Implement pagination (max 100 items)
- Use compression for large responses
- Cache static responses
- Set appropriate timeouts

### Code Optimization

- Avoid N+1 queries
- Use async/await efficiently
- Don't block event loop
- Profile before optimizing

---

## 🐛 Reporting Bugs

### Bug Report Template

**Title:** [Short, descriptive title]

**Description:**
Clear description of the bug

**To Reproduce:**
1. Step 1
2. Step 2
3. See error

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- OS: [e.g., macOS 14.0]
- Node: [e.g., 20.11.0]
- pnpm: [e.g., 10.0.0]
- Browser: [if applicable]

**Error Messages:**
```
Paste error messages here
```

**Additional Context:**
Any other relevant information

---

## 💡 Feature Requests

### Feature Request Template

**Title:** [Short, descriptive title]

**Problem:**
What problem does this feature solve?

**Proposed Solution:**
How should this work?

**Alternatives:**
What other solutions were considered?

**Benefits:**
Why is this valuable?

**Implementation Notes:**
Any technical considerations

---

## 📚 Documentation Standards

### All Docs Should Have:

- Clear title and purpose
- Table of contents (if >100 lines)
- Code examples (tested)
- Common pitfalls section
- Last updated date

### Code Examples

```typescript
// ✅ CORRECT - Complete, runnable example
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = userSchema.parse(req.body);
    // Handle registration...
  } catch (error) {
    // Handle validation error...
  }
});

// ❌ WRONG - Incomplete snippet
const schema = z.object({...});
```

---

## ⚖️ Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome diverse perspectives
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing private information
- Unprofessional conduct

### Enforcement

Violations may result in:
1. Warning
2. Temporary ban
3. Permanent ban

Report issues to [CONTACT_EMAIL]

---

## 🆘 Getting Help

### Before Asking

1. Check [FAQ](FAQ.md)
2. Search existing issues
3. Read relevant documentation

### Asking Questions

**Good Question:**
- Clear title
- Context provided
- What you've tried
- Error messages included
- Minimal reproduction

**Bad Question:**
- "It doesn't work"
- No context
- No error messages
- Unclear what was tried

---

## 🎓 Learning Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Anthropic API Docs](https://docs.anthropic.com/)

---

## 📞 Contact

- **Security Issues:** [SECURITY_EMAIL] (private)
- **General Questions:** GitHub Discussions
- **Bug Reports:** GitHub Issues
- **Feature Requests:** GitHub Issues

---

## 🙏 Thank You!

Your contributions make MTG Agent better for everyone. We appreciate your time and effort!

---

**Last Updated:** 2025-01-04
