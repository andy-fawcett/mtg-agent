# Check Project Status

Quick status check for MTG Agent project progress.

---

## 📊 Status Check Procedure

### Step 1: Read STATUS.md
Load the current project status from `STATUS.md` in the project root.

### Step 2: Calculate Progress
Based on STATUS.md:
- Count completed sub-phases
- Count total sub-phases
- Calculate percentage
- Identify current task

### Step 3: Check for Blockers
Look for any noted blockers or issues in STATUS.md

### Step 4: Present Status Report

Display to user:

```
📊 MTG AGENT - PROJECT STATUS
═══════════════════════════════════════

🎯 CURRENT PHASE
   Phase: [Phase X - Name]
   Sub-Phase: [Phase X.Y - Name]
   Task: [Current task description]

📈 OVERALL PROGRESS
   Implementation: [X%] complete
   Phase 1: [Y%] complete

   ✓ Completed: [N] sub-phases
   ⏳ In Progress: [Phase X.Y - Name]
   ⏸️ Pending: [N] sub-phases

⏱️ TIME TRACKING
   Estimated Remaining: [X hours] for current phase
   Target Completion: [Date or relative time]

🚧 BLOCKERS
   [List any blockers or "None"]

📝 RECENT ACTIVITY
   [Last 3 activities from STATUS.md]

───────────────────────────────────────
🚀 NEXT STEPS

[What comes next - e.g., "Ready to start Phase 1.0" or "Continue with database migrations"]

💡 TIP: Run /start to begin/resume work
```

### Step 5: Offer Actions

Based on status:
- If not started: "Run `/start` to begin Phase 1.0"
- If in progress: "Run `/start` to continue where you left off"
- If phase complete: "Run `/start` to begin next phase"
- If blocked: "Review blocker notes and resolve before continuing"

---

## 📋 Status Indicators

**Phase Status:**
- ⏸️ Not Started
- 🏃 In Progress (with percentage)
- ✅ Complete
- ⚠️ Blocked

**Overall Progress Calculation:**
```
Phase 1: 8 sub-phases
- If 2 complete, 1 in progress (50%), 5 pending
- Progress = (2 + 0.5) / 8 = 31.25%
```

---

## 🎯 Quick Status Examples

### Example 1: Project Just Started
```
📊 MTG AGENT - PROJECT STATUS

🎯 CURRENT PHASE
   Phase: Phase 1 - MVP
   Sub-Phase: Phase 1.0 - Foundation
   Task: Ready to begin project setup

📈 OVERALL PROGRESS
   Implementation: 0% complete
   Phase 1: 0% complete

   ✓ Completed: 0 sub-phases
   ⏳ In Progress: None
   ⏸️ Pending: 8 sub-phases

⏱️ TIME TRACKING
   Estimated Remaining: 4-6 hours for Phase 1.0
   Target Completion: ~2 weeks for Phase 1

🚧 BLOCKERS
   None

📝 RECENT ACTIVITY
   - Documentation completed
   - STATUS.md created
   - Ready to begin implementation

───────────────────────────────────────
🚀 NEXT STEPS

Begin Phase 1.0 - Foundation & Project Setup
This includes: TypeScript setup, Docker Compose, Express server

💡 TIP: Run /start to begin development
```

### Example 2: Mid-Development
```
📊 MTG AGENT - PROJECT STATUS

🎯 CURRENT PHASE
   Phase: Phase 1 - MVP
   Sub-Phase: Phase 1.2 - Authentication
   Task: Implementing session management

📈 OVERALL PROGRESS
   Implementation: 25% complete
   Phase 1: 25% complete

   ✓ Completed: Phase 1.0 (Foundation), Phase 1.1 (Database)
   ⏳ In Progress: Phase 1.2 (Authentication) - 60%
   ⏸️ Pending: 5 sub-phases remaining

⏱️ TIME TRACKING
   Estimated Remaining: 3-4 hours for Phase 1.2
   Target Completion: On track for 2-week timeline

🚧 BLOCKERS
   None

📝 RECENT ACTIVITY
   - Phase 1.1 completed: PostgreSQL schema and migrations done
   - User registration endpoint implemented
   - Session middleware in progress

───────────────────────────────────────
🚀 NEXT STEPS

Continue Phase 1.2: Implement session validation and login endpoint

💡 TIP: Run /start to resume work
```

---

## 🔍 Detailed View Option

If user wants more details, also show:

**Completed Tasks:**
- [ List of completed sub-phases with checkmarks ]

**Current Task Breakdown:**
- [ Specific tasks from current phase doc ]
- [ Show which are done, which are pending ]

**Upcoming:**
- [ Next 2-3 sub-phases ]

---

## 💡 Usage

```
/status
```

Quick status check without starting a work session. Perfect for:
- Checking progress at a glance
- Understanding what's been done
- Identifying what's next
- Seeing if there are blockers

For actual development work, use `/start` instead.
