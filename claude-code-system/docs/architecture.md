# Architecture

## Overview
Modular monolith — single Next.js 14 full-stack app deployed on Railway.
No microservices. No monorepo. Add complexity only when proven necessary (>50k MAU).

## System Diagram
```
Browser → Next.js App (Railway Web)
              ├── App Router (SSR/ISR/CSR pages)
              ├── API Routes (all backend logic)
              └── Middleware (auth + RBAC + rate limit)
                    │
         ┌──────────┼──────────────┐
         ▼          ▼              ▼
      PostgreSQL   Redis        Cloudflare R2
      (Prisma)   (Upstash)      (file storage)
                    │
               BullMQ Queues
                    │
         Railway Worker Process
              ├── email.job
              ├── invoice.job
              ├── embedding.job
              └── demo-expire.job

External Services:
  Stripe/Razorpay → payment webhooks → /api/payments/*/webhook
  Pusher → realtime events (notifications, chat, tickets)
  OpenAI → AI chat + embeddings
  Resend → transactional email
```

## Key Architecture Decisions
See `docs/decisions/` for full ADRs.

| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 full-stack | One app, one deploy |
| Database | PostgreSQL only | Removes MongoDB complexity |
| Queue | BullMQ + Redis | Redis already needed for rate limiting |
| Realtime | Pusher | No server to maintain vs Socket.io |
| Storage | Cloudflare R2 | Zero egress cost vs S3 |
| Deploy | Railway | Minutes to deploy vs ECS + Terraform |

## Scaling Trigger Points
Switch to microservices ONLY when you hit:
- >50k MAU
- >10M API calls/month
- Team >8 engineers
- Need independent deploy cadences per service
