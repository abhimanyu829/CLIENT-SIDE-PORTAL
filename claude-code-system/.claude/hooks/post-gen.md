# Hook: Post-Generation

## Runs After: Any Code Generation

## Auto-Checklist (run on every generated file)

```
After generating, verify:

TypeScript
- [ ] Zero `any` types
- [ ] All function parameters typed
- [ ] Return types explicit on exported functions

Security
- [ ] No secrets in code
- [ ] Auth check present (if API route)
- [ ] Input validated with Zod (if accepting user input)
- [ ] Webhook signature verified (if webhook handler)

Quality
- [ ] No console.log (use logger)
- [ ] No TODO comments
- [ ] Error handling present
- [ ] API response matches { success, data?, error? } shape

UI (if applicable)
- [ ] Dark mode works (uses Tailwind dark: variants or CSS vars)
- [ ] Mobile layout correct
- [ ] Loading state present
- [ ] Error state present
- [ ] Empty state present

Database (if applicable)
- [ ] Audit log written for mutations
- [ ] Pagination on list queries
- [ ] select/include used (no full object returns with sensitive fields)

If ANY box is unchecked → fix before considering the task done.
```
