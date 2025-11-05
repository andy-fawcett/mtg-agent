# Phase X: [Phase Name]

**Status:** ⏸️ Not Started | 🔄 In Progress | ✅ Completed | ❌ Blocked
**Duration Estimate:** X days/weeks
**Actual Duration:** [Fill when complete]
**Prerequisites:** [List required phases or "None"]

## Overview

Brief 2-3 sentence description of what this phase accomplishes and why it's important.

## Objectives

Clear, measurable goals for this phase:

- **Objective 1:** Specific deliverable with success metric
- **Objective 2:** Specific deliverable with success metric
- **Objective 3:** Specific deliverable with success metric
- **Objective 4:** Specific deliverable with success metric

## Why This Phase

### Business Justification
- Why this phase is necessary from a business perspective
- What value it provides to users or the project
- What risks it mitigates

### Technical Justification
- Why this phase is necessary from a technical perspective
- What it enables for future development
- What technical debt it addresses

### Dependencies
- What previous work this builds upon
- What future work depends on this
- Why this ordering makes sense

## Sub-Phases

### Phase X.0: [Sub-Phase Name]
**Time Estimate:** X hours
**Status:** ⏸️ Not Started

Brief description of what this sub-phase accomplishes.

**Key Deliverables:**
- Deliverable 1
- Deliverable 2

---

### Phase X.1: [Sub-Phase Name]
**Time Estimate:** X hours
**Status:** ⏸️ Not Started

Brief description.

**Key Deliverables:**
- Deliverable 1
- Deliverable 2

---

### Phase X.2: [Sub-Phase Name]
**Time Estimate:** X hours
**Status:** ⏸️ Not Started

Brief description.

**Key Deliverables:**
- Deliverable 1
- Deliverable 2

---

[Continue for all sub-phases...]

## Technology Stack

**Primary Technologies:**
- Technology 1 - Purpose and why chosen
- Technology 2 - Purpose and why chosen
- Technology 3 - Purpose and why chosen

**Key Dependencies:**
```json
{
  "dependency1": "^version",
  "dependency2": "^version"
}
```

## Architecture Decisions

### Decision 1: [What was decided]
**Context:** Why this decision was necessary
**Options Considered:**
- Option A: Pros and cons
- Option B: Pros and cons
- Option C: Pros and cons

**Decision:** Option X chosen because...

**Consequences:**
- Positive consequence 1
- Positive consequence 2
- Trade-off 1

---

### Decision 2: [What was decided]
**Context:** ...
**Options Considered:** ...
**Decision:** ...
**Consequences:** ...

## Success Criteria

Phase is complete when ALL of the following are true:

### Functional Requirements
- [ ] Feature X works as specified
- [ ] Feature Y works as specified
- [ ] Feature Z works as specified

### Technical Requirements
- [ ] All code follows project standards
- [ ] TypeScript compiles without errors
- [ ] All tests pass (unit + integration)
- [ ] Code coverage > X%
- [ ] No linting errors
- [ ] Performance targets met

### Documentation Requirements
- [ ] All code has inline comments
- [ ] README files updated
- [ ] API documentation complete
- [ ] User documentation complete (if applicable)

### Security Requirements
- [ ] Security checklist items passed
- [ ] No hardcoded secrets
- [ ] Input validation implemented
- [ ] Output sanitization implemented
- [ ] Authentication working (if applicable)
- [ ] Authorization working (if applicable)

### Testing Requirements
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Manual testing completed
- [ ] Edge cases tested
- [ ] Error scenarios tested
- [ ] Performance tested

### Deployment Requirements
- [ ] Runs in development environment
- [ ] Docker configuration working
- [ ] Environment variables documented
- [ ] Migration scripts ready (if applicable)
- [ ] Rollback procedure tested

## Risk Assessment

### High Risks
**Risk:** [Description of risk]
- **Likelihood:** High | Medium | Low
- **Impact:** High | Medium | Low
- **Mitigation:** How we're addressing this
- **Contingency:** What we'll do if it happens

**Risk:** [Another risk]
- **Likelihood:** ...
- **Impact:** ...
- **Mitigation:** ...
- **Contingency:** ...

### Medium Risks
[Same format as high risks]

### Low Risks
[Same format as high risks]

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Response Time (p95) | < X ms | Load testing |
| Memory Usage | < X MB | Docker stats |
| Database Queries | < X ms | Query profiling |
| API Throughput | > X req/sec | Load testing |

## Testing Strategy

### Unit Testing
**Coverage Target:** X%
**Tools:** Jest, testing-library
**Focus Areas:**
- Business logic functions
- Utility functions
- Edge cases and error handling

### Integration Testing
**Tools:** Supertest, test database
**Focus Areas:**
- API endpoints
- Database operations
- Service integrations

### Manual Testing
**Test Cases:**
1. Happy path scenario
2. Error scenario
3. Edge case scenario
4. Performance scenario

### Security Testing
- Input validation testing
- Authentication/authorization testing
- XSS prevention testing
- SQL injection prevention testing

## Rollback Procedure

If this phase needs to be rolled back:

```bash
# Step 1: Identify commit before phase started
git log --oneline

# Step 2: Create rollback branch
git checkout -b rollback-phase-X

# Step 3: Revert to previous state
git revert <commit-range>

# Step 4: If database changes, restore from backup
psql $DATABASE_URL < backup_before_phase_X.sql

# Step 5: Restart services
docker-compose down
docker-compose up -d

# Step 6: Verify services healthy
curl http://localhost:3000/health
```

**When to Rollback:**
- Critical bugs discovered
- Performance unacceptable
- Security vulnerabilities found
- Breaking changes to existing functionality
- Cannot meet phase success criteria

## Common Issues & Solutions

### Issue: [Problem Description]
**Symptoms:**
- Symptom 1
- Symptom 2

**Root Cause:** Explanation

**Solution:**
```bash
# Commands to fix
fix-command
```

**Prevention:** How to avoid this in future

---

### Issue: [Another Problem]
[Same format]

## Phase Completion Checklist

Before marking this phase as complete:

### Code Quality
- [ ] All code reviewed
- [ ] No TODO comments left
- [ ] No console.log statements
- [ ] Error handling comprehensive
- [ ] Logging appropriate

### Testing
- [ ] All tests passing
- [ ] Coverage targets met
- [ ] Manual testing complete
- [ ] Security testing done
- [ ] Performance testing done

### Documentation
- [ ] This README updated
- [ ] All sub-phase docs complete
- [ ] Code comments added
- [ ] API docs updated
- [ ] User docs updated (if needed)

### Git & Version Control
- [ ] All changes committed
- [ ] Meaningful commit messages
- [ ] No merge conflicts
- [ ] Branch up to date with main

### Security
- [ ] Security checklist complete
- [ ] No secrets in code
- [ ] Dependencies updated
- [ ] Vulnerabilities addressed

### Deployment
- [ ] Works in Docker
- [ ] Environment variables set
- [ ] Migrations run successfully
- [ ] Services start cleanly

### Communication
- [ ] Stakeholders notified
- [ ] Documentation published
- [ ] Known issues documented
- [ ] Next phase dependencies identified

## Metrics & Outcomes

### Planned vs Actual

| Metric | Planned | Actual | Variance |
|--------|---------|--------|----------|
| Duration | X days | Y days | +/- Z days |
| Lines of Code | ~X | Y | - |
| Test Coverage | X% | Y% | - |
| Bugs Found | - | X | - |

### Lessons Learned

**What Went Well:**
- Success 1
- Success 2
- Success 3

**What Could Be Improved:**
- Improvement area 1
- Improvement area 2
- Improvement area 3

**Insights for Future Phases:**
- Insight 1
- Insight 2
- Insight 3

## Related Documentation

- [Previous Phase](../PHASE_X-1/README.md)
- [Next Phase](../PHASE_X+1/README.md)
- [Overall Roadmap](../ROADMAP.md)
- [Architecture Document](../../BACKEND_ARCHITECTURE.md)
- [Security Documentation](../../SECURITY_ARCHITECTURE.md)

## Timeline

```
Week 1:
├── Day 1-2: Phase X.0 (Foundation)
├── Day 3-4: Phase X.1 (Core Feature)
└── Day 5: Phase X.2 (Testing)

Week 2:
├── Day 1-2: Phase X.3 (Integration)
├── Day 3: Phase X.4 (Documentation)
└── Day 4-5: Phase X.5 (Polish & Review)
```

## Team & Responsibilities

| Role | Responsibility | Person |
|------|---------------|--------|
| Developer | Implementation | [Name] |
| Reviewer | Code review | [Name] |
| Tester | QA testing | [Name] |
| Documentation | Docs writing | [Name] |

## Sign-Off

**Development Complete:** ☐
- Completed by: _______________
- Date: _______________

**Testing Complete:** ☐
- Completed by: _______________
- Date: _______________

**Documentation Complete:** ☐
- Completed by: _______________
- Date: _______________

**Phase Approved:** ☐
- Approved by: _______________
- Date: _______________

---

**Phase Status:** [Final status]
**Completion Date:** YYYY-MM-DD
**Next Phase:** [Link to next phase]
