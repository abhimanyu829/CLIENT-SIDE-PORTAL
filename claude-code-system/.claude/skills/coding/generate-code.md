# Skill: Generate Code

## When to Use
Any time you need to write a new file, component, API route, or utility.

## Pre-Generation Checklist
Before writing a single line, answer these:
1. What is this file's single responsibility?
2. What does it import? Do all imports exist?
3. What does it export? Who consumes it?
4. Does a similar pattern exist in `.claude/memory/patterns.md`?
5. Will this need a test? (Answer is almost always yes)

## Generation Prompt
```
Generate [FILE_TYPE] at [PATH] that does [SINGLE_RESPONSIBILITY].

Context:
- Imports needed: [LIST]
- Exports: [LIST]
- Follows pattern: [PATTERN_NAME from patterns.md]
- TypeScript strict: no any
- Must handle: loading state, error state, empty state (for UI)
- Must handle: auth check, input validation, error response (for API)

Do NOT:
- Add console.log
- Hardcode secrets or URLs
- Skip error handling
- Leave TODOs or stubs
```

## Post-Generation Checklist
- [ ] No `any` types
- [ ] No hardcoded secrets
- [ ] Error handling present
- [ ] Dark mode compatible (UI files)
- [ ] Matches API response shape `{ success, data?, error? }`
- [ ] Audit log added (for mutations)
- [ ] Added to correct route group (app router)
