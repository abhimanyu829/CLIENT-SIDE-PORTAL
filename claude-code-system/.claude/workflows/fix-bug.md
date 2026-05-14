# Workflow: Fix a Bug

## Rule
Fix ONLY the bug. Touch nothing else. Resist the urge to refactor while fixing.

## Process

### 1. Reproduce First
```
Do not read code until you can reproduce the bug consistently.
Document: exact steps, input, expected output, actual output.
If you can't reproduce it, you can't fix it.
```

### 2. Isolate
```
Binary search the codebase:
- Is it the frontend or the API? (Check Network tab)
- Is it the API or the DB? (Check logs, query DB directly)  
- Is it the DB query or the business logic? (Add temporary log)
- Is it this function or the one calling it? (Trace the call stack)
```

### 3. Read the Relevant Skill
```
Check .claude/skills/coding/debug.md for this bug type.
Check .claude/memory/mistakes.md — has this been seen before?
```

### 4. Write a Failing Test First
```
Before fixing, write a test that:
- Reproduces the exact bug scenario
- Fails with the current code
- Will pass when the bug is fixed

This proves you found the real cause and prevents regression.
```

### 5. Fix
```
Make the minimal change. Run the failing test → it should now pass.
Run the full test suite → nothing new should break.
```

### 6. Document
```
If this is a pattern worth remembering:
- Add to .claude/memory/mistakes.md
- Add the test to prevent regression
- Update CHANGELOG.md: [DATE] Bug fix — description
```
