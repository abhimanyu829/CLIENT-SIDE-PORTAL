# Task Prompt: Build API Route

## Fill In and Send to Claude

```
Build API route at: app/api/[RESOURCE]/route.ts

Resource: [e.g., products, users, subscriptions]
Methods needed: [GET | POST | PATCH | DELETE]

GET requirements:
- Auth required: [yes/no, and what role]
- Filters: [list query params]
- Pagination: cursor-based, default limit 20
- Returns: [what data shape]

POST requirements:
- Auth required: [yes/no]
- Request body schema: [list fields and types]
- Validation: Zod schema
- Side effects: [emails? jobs? notifications?]
- Audit log: yes (always for mutations)

Rules (always apply):
- Response shape: { success, data?, error?: { code, message }, meta? }
- TypeScript strict, no any
- No console.log, use logger from lib/logger.ts
- Prisma from lib/db.ts
- Auth via getServerSession(authOptions) from lib/auth.ts
- Rate limit via middleware.ts (already applied globally)

Do NOT add extra endpoints not listed above.
Write the complete file.
```
