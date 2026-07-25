# Project: Subscription & Billing Center (NexusAI)

## Architecture
- Next.js (App Router) + TypeScript + Prisma + Tailwind/Shadcn + Clerk Auth + Razorpay
- Directory layout: root `app/`, `lib/`, `components/`, `prisma/`
- Admin module under `app/(admin)/admin/subscription-center/` with 15 sub-modules
- User Premium Workspace under `app/(dashboard)/dashboard/premium/`
- Single source of truth backend access control & pricing

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Codebase Exploration & Tech Spec | Inspect existing auth, middleware, RBAC, Prisma models, Razorpay integration, dashboard layout | none | DONE |
| 2 | Prisma Schema & DB Layer | Extend Prisma schema with 8 subscription models + generate client & seed default plans | M1 | IN_PROGRESS |
| 3 | Admin Subscription & Billing Center | Implement backend APIs and UI for 15 sub-modules under `/admin/subscription-center` | M2 | PLANNED |
| 4 | Premium Workspace & Payment Lifecycle | Implement `/dashboard/premium` workspace, 403/redirect enforcement, Razorpay flow, backend pricing, invoice generation, lifecycle management | M2, M3 | PLANNED |
| 5 | Comprehensive Testing & Audit Verification | End-to-end integration tests, type checks, build verification, auditor verification | M4 | PLANNED |

## Code Layout
- Root directory: `c:\Users\Abhimanyu\Desktop\start-client`
- Prisma Schema: `prisma/schema.prisma`
- Admin routes: `app/(admin)/admin/subscription-center/`
- User Premium Workspace: `app/(dashboard)/dashboard/premium/`
- API routes: `app/api/`
- Shared services/lib: `lib/`
