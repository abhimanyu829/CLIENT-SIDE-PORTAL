# Skill: Debug

## Debugging Process (follow this order, do not skip steps)

### Step 1 — Reproduce
```
Describe the exact steps to reproduce the bug:
1. What endpoint / page / component is affected?
2. What input triggers it?
3. What is the expected output?
4. What is the actual output (error message, wrong data, blank screen)?
5. Is it consistent or intermittent?
```

### Step 2 — Locate
```
Narrow down the source:
- Is it a TypeScript compile error? → Check tsc output
- Is it a runtime error? → Check server logs (Pino) or browser console
- Is it a data error? → Query the DB directly
- Is it a network error? → Check API response in Network tab
- Is it an auth error? → Check session/JWT payload
```

### Step 3 — Hypothesize
```
Form 2-3 hypotheses ranked by likelihood.
For each: "The bug is caused by X because Y evidence supports it."
Test the most likely one first.
```

### Step 4 — Fix
```
Apply the minimal fix that solves the root cause.
Do NOT:
- Add workarounds that mask the real problem
- Change unrelated code
- Add try/catch to silence errors without handling them
```

### Step 5 — Verify
```
After fixing:
1. Reproduce the original steps — does the bug still appear? No? Good.
2. Run the relevant test suite.
3. Check edge cases: empty input, null values, unauthenticated user.
4. Check that the fix didn't break adjacent functionality.
```

### Step 6 — Document
```
Add the bug + fix to .claude/memory/mistakes.md if it's a pattern worth remembering.
```

## Common Bug Patterns in This Stack
- Prisma: `Cannot read property of null` → missing `include` or wrong relation name
- NextAuth: `session is null` → forgot `getServerSession(authOptions)` not `getSession()`
- BullMQ: job silently not processing → worker process not running (`npm run worker`)
- Pusher: events not received → channel name mismatch or missing auth endpoint
- Stripe webhook: 400 on signature verify → raw body not passed (use `req.text()` not `req.json()`)
- R2: presigned URL expired → default 5min, client must upload immediately
