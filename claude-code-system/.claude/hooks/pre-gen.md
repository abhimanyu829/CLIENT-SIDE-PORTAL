# Hook: Pre-Generation

## Runs Before: Any Code Generation

## Checklist (Claude must confirm these before writing code)

```
Before generating any file, confirm:

1. I have read CLAUDE.md → I know the stack, rules, and current phase
2. I have read ROADMAP.md → I am working on the correct phase
3. I have read .claude/memory/patterns.md → I know which pattern to follow
4. I have read .claude/memory/mistakes.md → I will not repeat known mistakes
5. The task is scoped correctly → I know exactly ONE thing this file does
6. All imports I need exist → I am not importing something that doesn't exist yet
7. I understand the expected output → I know what "done" looks like

If any of the above is NO → stop and clarify before generating.
```

## Auto-Inject Context
When generating code, always include this context in your prompt:
```
Stack: Next.js 14, TypeScript strict, Prisma, Redis, BullMQ, Pusher, Stripe, R2, Resend, OpenAI
API shape: { success, data?, error?: { code, message }, meta? }
No any types. No console.log. No hardcoded secrets. No TODOs.
Mobile-first + dark mode on all UI.
```
