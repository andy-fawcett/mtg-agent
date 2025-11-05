# Creating Phase Documentation

This guide explains how to create detailed phase documentation when reaching Phases 2-5.

---

## 📋 When You Need This

Phase 1 has detailed documentation with 7 sub-phases. Phases 2-5 currently only have README files with **goals** but not **detailed tasks**.

When you run `/start` and reach Phase 2+, Claude will detect the missing detailed documentation and offer to help create it.

---

## 🎯 Goal

Transform a phase README (with goals) into detailed task documentation similar to Phase 1, with:
- Specific sub-phases (e.g., PHASE_2.1, PHASE_2.2, etc.)
- Step-by-step tasks
- Code examples
- Verification commands
- Success criteria
- Time estimates

---

## 🛠️ Process

### Step 1: Claude Detects Missing Documentation

When `/start` is run for Phase 2+:

```
⚠️ PHASE DOCUMENTATION NEEDED

Current Phase: Phase 2 - Security Hardening
Status: Only goals documented (README exists)

Before implementation, we need to create detailed task documentation
for this phase, similar to how Phase 1 is documented.

Options:
1. Let me help you create Phase 2 detailed documentation
2. You create the documentation manually first
3. Skip to a different task

Would you like me to help create the Phase 2 documentation using
the documentation-best-practices skill?
```

### Step 2: User Chooses Option

**Option 1: Claude Creates Documentation**
- Claude will use the `documentation-best-practices` skill
- Breaks down the phase goals into sub-phases
- Creates detailed PHASE_X.Y_*.md files
- Follows the same structure as Phase 1

**Option 2: Manual Creation**
- You create the documentation yourself
- Follow the template below
- Run `/start` again when done

**Option 3: Skip**
- Move to a different task
- Come back to this phase later

---

## 📝 Documentation Template

### File Structure

For Phase 2 (Security Hardening), create files like:

```
docs/implementation/PHASE_2_SECURITY/
├── README.md                    # Already exists (goals)
├── PHASE_2.1_PENETRATION_TESTING.md
├── PHASE_2.2_JAILBREAK_TESTING.md
├── PHASE_2.3_PERFORMANCE_OPTIMIZATION.md
├── PHASE_2.4_SECURITY_AUDIT.md
└── PHASE_2.5_MONITORING_ALERTS.md
```

### Sub-Phase Document Template

Use this template for each PHASE_X.Y_*.md file:

```markdown
# Phase X.Y: [Sub-Phase Name]

**Status:** ⏸️ Not Started
**Duration Estimate:** X-Y hours
**Prerequisites:** Phase X.(Y-1) complete
**Dependencies:** [List dependencies]

## Objectives

[Clear description of what this sub-phase accomplishes]

- Goal 1
- Goal 2
- Goal 3

## Technology Decisions

[Any decisions made for this sub-phase]

---

## Task X.Y.1: [Task Name]

**Estimated Time:** X minutes/hours

### Objectives

[What this task accomplishes]

### Steps

[Step-by-step instructions with code examples]

```bash
# Example commands
command here
```

```typescript
// Example code
code here
```

### Verification

```bash
# Commands to verify completion
verification commands
```

### Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Common Issues

**Issue:** [Description]
**Solution:** [How to fix]

---

## Task X.Y.2: [Next Task]

[Repeat structure]

---

## Phase X.Y Completion Checklist

- [ ] All tasks completed
- [ ] All verification commands pass
- [ ] Documentation updated
- [ ] Tests pass
- [ ] Security requirements met
- [ ] Committed to git

## Next Steps

Proceed to [Phase X.(Y+1)](PHASE_X.Y+1_NAME.md)
```

---

## 📚 Example: Phase 2.1 - Penetration Testing

Here's what Phase 2.1 documentation might look like:

```markdown
# Phase 2.1: Penetration Testing

**Status:** ⏸️ Not Started
**Duration Estimate:** 6-8 hours
**Prerequisites:** Phase 1 (MVP) complete
**Dependencies:** Working application with auth and API endpoints

## Objectives

Conduct comprehensive penetration testing to identify vulnerabilities before public access.

- Test all API endpoints for common vulnerabilities
- Verify authentication cannot be bypassed
- Test rate limiting under attack scenarios
- Verify SQL injection prevention
- Test XSS attack prevention

---

## Task 2.1.1: Setup Penetration Testing Tools

**Estimated Time:** 30 minutes

### Objectives

Install and configure security testing tools.

### Steps

1. Install OWASP ZAP
```bash
# macOS
brew install --cask owasp-zap

# Linux
wget https://github.com/zaproxy/zaproxy/releases/download/v2.14.0/ZAP_2.14.0_Linux.tar.gz
```

2. Install Burp Suite Community
3. Install sqlmap
```bash
pip install sqlmap
```

### Verification

```bash
zap.sh -version
sqlmap --version
```

### Success Criteria

- [ ] OWASP ZAP installed
- [ ] Burp Suite installed
- [ ] sqlmap installed
- [ ] All tools launch successfully

---

## Task 2.1.2: Test Authentication Bypass

[Continue with detailed tasks...]
```

---

## 🔄 Workflow When Creating Phase Documentation

1. **Review Phase README**
   - Understand the goals
   - Identify major components
   - Estimate sub-phases needed

2. **Break Down Into Sub-Phases**
   - Each sub-phase should take 3-8 hours
   - Group related tasks together
   - Order by dependencies

3. **Create Detailed Task Files**
   - Use the template above
   - Include code examples
   - Add verification commands
   - List success criteria

4. **Review and Refine**
   - Ensure clarity
   - Check time estimates
   - Verify all dependencies listed
   - Make sure it follows Phase 1 structure

5. **Update Phase README**
   - Add links to all sub-phase docs
   - Update status
   - Add estimated total time

6. **Update STATUS.md**
   - Mark phase as "Ready to Begin"
   - Update with first sub-phase task

7. **Run `/start` Again**
   - Claude will now load the detailed documentation
   - Can begin implementation

---

## ✅ Quality Checklist

Before considering phase documentation complete:

- [ ] All major goals from phase README broken into tasks
- [ ] Each sub-phase has time estimate (3-8 hours)
- [ ] All tasks have clear objectives
- [ ] Code examples provided where relevant
- [ ] Verification commands included
- [ ] Success criteria checkboxes added
- [ ] Common issues and solutions documented
- [ ] Dependencies clearly listed
- [ ] Follows same structure as Phase 1 docs
- [ ] Links work (no broken references)
- [ ] Reviewed with `documentation-best-practices` skill

---

## 💡 Tips

1. **Start with the phase README** - It has the high-level goals
2. **Look at Phase 1 for examples** - Keep structure consistent
3. **Ask Claude for help** - Use the documentation-best-practices skill
4. **Be specific** - "Test authentication" vs "Test login endpoint with invalid credentials"
5. **Include time estimates** - Helps with planning
6. **Add verification steps** - Makes it clear when done
7. **Document decisions** - Explain "why" not just "what"

---

## 🤖 Using Claude to Create Documentation

When Claude offers to help create phase documentation:

```
Would you like me to help create the Phase 2 documentation using
the documentation-best-practices skill?
```

Say **yes**, and Claude will:

1. Load the `documentation-best-practices` skill
2. Review the phase README (goals)
3. Break down into logical sub-phases
4. Create detailed task documents
5. Follow Phase 1 structure
6. Include all necessary sections
7. Update STATUS.md

Then you can review and refine before starting implementation.

---

**Last Updated:** 2025-01-04
**Use Case:** Creating detailed documentation for Phases 2-5 when reaching them
