# Known Mistakes — Never Repeat These

## TypeScript
- ❌ Using `any` — use `unknown` and narrow, or define the type
- ❌ Forgetting `"use client"` on components using hooks/browser APIs
- ❌ Using `process.env.X` directly — always go through `lib/env.ts`
- ❌ Returning raw Prisma objects with `passwordHash` — always select fields explicitly

## Database
- ❌ Running `prisma db push` in production — use migrations only
- ❌ N+1 queries — always `include` relations or use `select` carefully
- ❌ Missing `@@index` on foreign keys and frequently filtered fields
- ❌ Storing secrets in DB unencrypted — use `lib/encryption.ts`

## Auth
- ❌ Trusting `session.user.role` from client for server-side checks — always re-fetch from DB or JWT
- ❌ Forgetting CSRF protection on mutations
- ❌ Not validating webhook signatures (Stripe, Razorpay, Pusher)

## Payments
- ❌ Using test keys in production env — always check `NODE_ENV`
- ❌ Processing webhooks without idempotency check — check `gatewayPaymentId` exists first
- ❌ Blocking API response waiting for invoice PDF — always queue it

## UI
- ❌ Hardcoding colors instead of Tailwind/CSS vars — breaks dark mode
- ❌ Using `<form>` submit instead of react-hook-form handleSubmit
- ❌ Not adding loading/error states on async actions

## Performance
- ❌ Streaming large files through Next.js — use R2 presigned URLs
- ❌ Running embedding generation synchronously — always queue it
- ❌ Not paginating list queries — always use cursor pagination
