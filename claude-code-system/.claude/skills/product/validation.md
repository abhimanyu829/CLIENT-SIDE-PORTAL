# Skill: Product Validation

## Code Review Validation Prompt
```
Review this code for production-readiness:
[PASTE CODE]

Check for:
1. TypeScript: any types, missing types, incorrect types
2. Security: unvalidated input, missing auth checks, SQL injection via Prisma raw, exposed secrets
3. Performance: N+1 queries, missing indexes, synchronous heavy operations
4. Error handling: unhandled promise rejections, missing try/catch, swallowed errors
5. Business logic: edge cases (null, empty array, 0, negative numbers, concurrent requests)
6. Standards: follows patterns in .claude/memory/patterns.md

Output format:
- BLOCKER: [issues that must be fixed before shipping]
- WARNING: [issues that should be fixed soon]
- SUGGESTION: [nice to have improvements]
```

## Feature Validation Prompt
```
We built [FEATURE]. Validate it is complete:

Functional checklist:
- [ ] Happy path works end-to-end
- [ ] Error states handled (network fail, invalid input, unauthorized)
- [ ] Empty states handled (no data, first-time user)
- [ ] Loading states present
- [ ] Mobile layout correct
- [ ] Dark mode correct

Security checklist:
- [ ] Auth check present (server-side, not just client)
- [ ] Input validated with Zod
- [ ] Rate limiting applied if user-facing
- [ ] Audit log written for mutations

Integration checklist:
- [ ] Webhook handlers are idempotent
- [ ] Background jobs retry on failure
- [ ] Emails send correctly
- [ ] DB relations correct (no orphaned records)
```

## Pre-Deploy Validation
```
Before deploying to production, verify:
1. `npm run typecheck` — zero errors
2. `npm run lint` — zero errors  
3. `npm test` — all pass
4. All env vars present in Railway dashboard
5. DB migration (not db push) applied to prod DB
6. Stripe/Razorpay webhook URLs updated to prod domain
7. NEXTAUTH_URL set to prod domain
```
