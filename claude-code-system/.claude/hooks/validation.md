# Hook: Validation

## Runs Before: Any Merge or Deploy

## Validation Prompt
```
[VALIDATION HOOK]
File: [PATH]
Feature: [FEATURE NAME]

Run the full validation suite:

1. TYPES: Does `tsc --noEmit` pass with zero errors?
2. LINT: Does `eslint [path]` pass with zero errors?
3. TESTS: Do all tests in `tests/` related to this feature pass?
4. SECURITY: Pass this file to the Reviewer agent for security check
5. INTEGRATION: Does the full user flow work end-to-end in browser?

Report results. Do not approve unless all 5 pass.
```

## Quick Validation (for small changes)
```
For a single-file change, at minimum:
- Typecheck: tsc confirms no errors in this file
- Manual test: the feature works in the browser
- No regressions: related features still work
```

## Database Migration Validation
```
Before applying any migration to production:
1. Apply to local DB → app still boots correctly
2. Apply to staging DB → full smoke test passes
3. Verify migration is reversible (or document why it isn't)
4. Estimate downtime (most Postgres migrations are instant, some lock tables)
Only then apply to production.
```
