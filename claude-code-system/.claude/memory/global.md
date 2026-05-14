# Global Memory

## Project Identity
- Name: SaaS + AI Marketplace Platform
- Stack: Next.js 14 full-stack, PostgreSQL, Redis, Railway
- Style: Modular monolith, ship fast, add complexity only when proven needed

## Decisions Made (never revisit without strong reason)
- No MongoDB — PostgreSQL handles everything including chat
- No Turborepo — single Next.js app
- No AWS ECS — Railway for deployment
- No Socket.io — Pusher for realtime
- No Kafka — BullMQ + Redis for queues
- Cloudflare R2 over S3 — zero egress cost

## Team Conventions
- Branch: `feat/task-X.Y-description`
- Commit: `[X.Y] short description`
- PR: must pass typecheck + lint + tests before merge
- Every DB change needs a migration, never `db push` in prod

## Environment Targets
- Local: `http://localhost:3000`
- Staging: Railway preview deploy
- Production: Railway production deploy
