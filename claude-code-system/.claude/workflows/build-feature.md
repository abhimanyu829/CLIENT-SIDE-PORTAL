# Workflow: Build Feature

## Use This When
You receive a new feature task (e.g., "Task 7.3 — Subscriptions page").

## Step-by-Step Process

### 1. Understand (Architect Agent)
```
Read the task spec carefully.
Ask the Architect agent to design:
- Data model changes
- API endpoints
- UI components
- Background jobs

Do not write code yet.
```

### 2. Plan
```
Break the feature into subtasks:
1. DB schema changes (if any)
2. API routes
3. Business logic / lib utilities
4. UI components (bottom-up: atoms → organisms → page)
5. Background jobs (if any)
6. Tests

Estimate each subtask. Flag any blockers.
```

### 3. Build (Coder Agent)
```
Build in this order:
1. DB schema + migration
2. API routes
3. Shared components
4. Page component
5. Tests

Use the Coder agent for each file.
Complete one subtask fully before starting the next.
```

### 4. Review (Reviewer Agent)
```
After all files are written:
1. Self-review: re-read every file against the checklist in validation.md
2. Pass each new file to the Reviewer agent
3. Fix all BLOCKERs before proceeding
4. Fix WARNINGs before merging to main
```

### 5. Test
```
1. Manual: walk through the feature as a real user
2. Automated: run `npm test -- --testPathPattern=[feature]`
3. Edge cases: empty data, error states, unauthorized access
```

### 6. Ship
```
1. Run pre-deploy validation checklist (skills/product/validation.md)
2. Merge to main
3. Railway auto-deploys
4. Update ROADMAP.md and CHANGELOG.md
```
