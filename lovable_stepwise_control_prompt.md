# ⚡ LOVABLE MASTER CONTROL PROMPT
# Small · Efficient · Stepwise · One Task at a Time
# ─────────────────────────────────────────────────

## PASTE THIS AS YOUR VERY FIRST MESSAGE IN LOVABLE:

---

You are a senior full-stack engineer. We are building a production-grade
SaaS + AI Marketplace Platform together, one task at a time.

STACK (locked — never change):
- Next.js 14 App Router (full-stack, no separate backend)
- TypeScript strict, Tailwind CSS, Shadcn/UI
- Prisma + PostgreSQL (single DB — no MongoDB)
- Redis/Upstash (rate limiting + BullMQ queues)
- NextAuth.js v5 (JWT + Google + GitHub)
- BullMQ (background jobs)
- Pusher (realtime — no self-hosted Socket.io)
- Stripe (USD) + Razorpay (INR)
- Cloudflare R2 (file storage — zero egress cost)
- Resend + React Email (transactional emails)
- OpenAI GPT-4o + pgvector (AI features)
- Zustand + React Query (state management)
- Railway (deployment)

RULES — follow strictly on every single task:
1. Build ONLY what I ask in each message. Nothing more.
2. Never skip ahead. Never auto-generate future files.
3. Every file must be complete — no stubs, no TODOs, no placeholders.
4. TypeScript strict — zero `any` types.
5. API response shape always: { success, data?, error?: { code, message }, meta? }
6. No hardcoded secrets — all from env vars.
7. No console.log — use Pino logger.
8. Mobile-first + dark mode on every UI component.
9. After completing each task, stop and wait for my next instruction.
10. If a task is too large, tell me — I will break it down further.

When I say "Task X.Y", build only that one thing.
When I say "done, next", move to the next task in the list.
When I say "fix [issue]", fix only that — touch nothing else.

Confirm you understand the stack, rules, and stepwise approach.
Reply with: "Ready. Waiting for Task 1.1."

---

## 📋 TASK LIST (give one task per message — copy-paste each)

### ── PHASE 1: SCAFFOLD ──

Task 1.1 — Create the folder structure only.
  No code yet. Just create all empty files and folders listed:
  app/(public)/, app/(auth)/, app/(dashboard)/, app/(admin)/, app/api/,
  components/ui/, components/layout/, components/marketing/,
  components/marketplace/, components/dashboard/, components/admin/,
  components/demo/templates/, components/payments/, components/shared/,
  lib/, hooks/, stores/, types/, emails/, jobs/, prisma/

Task 1.2 — Generate .env.example with all required keys (documented).

Task 1.3 — Generate lib/env.ts — Zod schema that validates all env vars
  at startup and crashes with a clear error message if any key is missing.

Task 1.4 — Generate tailwind.config.ts with custom design tokens:
  brand colors, font stack (Inter), border radius, spacing scale.

Task 1.5 — Generate next.config.js with full security headers:
  CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, image domains.

Task 1.6 — Generate lib/logger.ts using Pino.
  Export a default logger instance. Log level from env.

Task 1.7 — Generate lib/db.ts — Prisma singleton client.

Task 1.8 — Generate lib/redis.ts — Upstash Redis client.

Task 1.9 — Generate lib/utils.ts — cn(), formatCurrency(), formatDate(),
  slugify(), generateToken(), truncate().

Task 1.10 — Generate types/ files:
  api.ts (ApiResponse<T>, PaginatedResponse<T>),
  auth.ts (SafeUser, SessionUser), product.ts, payment.ts, crm.ts.

---

### ── PHASE 2: DATABASE ──

Task 2.1 — Generate prisma/schema.prisma.
  Include pgvector extension. Enums only (no models yet).

Task 2.2 — Add User, UserSession, ApiKey, Permission, UserPermission models
  to schema.prisma with all fields, relations, and @@index.

Task 2.3 — Add Product, ProductTier, ProductReview, DemoSession models.

Task 2.4 — Add Subscription, Payment, Invoice, Coupon models.

Task 2.5 — Add Project, ProjectFile, Ticket, TicketMessage models.

Task 2.6 — Add ChatRoom, ChatMessage, Lead, LeadInteraction, EmailSequence models.

Task 2.7 — Add AIAgent, Notification, AuditLog, BlogPost models.
  Run: prisma validate (check schema is valid before continuing).

Task 2.8 — Generate prisma/seed.ts:
  1 SUPER_ADMIN, 3 SUB_ADMINs (tech/marketing/finance),
  2 CLIENT users, 3 products with 3 tiers each,
  permissions matrix, 6 leads across pipeline stages.

---

### ── PHASE 3: AUTH ──

Task 3.1 — Generate lib/auth.ts — NextAuth v5 config:
  Providers: Google, GitHub, Credentials.
  JWT callbacks: embed userId, role, permissions[].
  Session callback: expose role + permissions to client.

Task 3.2 — Generate app/api/auth/[...nextauth]/route.ts.

Task 3.3 — Generate lib/permissions.ts:
  hasPermission(user, action, resource): boolean
  requirePermission(action, resource) server helper that throws if denied.

Task 3.4 — Generate lib/audit.ts:
  auditLog({ userId, action, entity, entityId, before?, after?, req? })
  Writes to AuditLog table async (non-blocking, never throws).

Task 3.5 — Generate middleware.ts:
  Protect /dashboard/* (CLIENT+), /admin/* (SUB_ADMIN+).
  Rate limiting on /api/* using Upstash Ratelimit.
  Redirect unauthenticated → /login?callbackUrl=...
  Redirect wrong role → /unauthorized.

Task 3.6 — Generate app/(auth)/login/page.tsx:
  Email + password form. Google + GitHub OAuth buttons.
  react-hook-form + Zod. Show error messages. Link to register.

Task 3.7 — Generate app/(auth)/register/page.tsx:
  Name, email, password, confirm password.
  Zod validation. On success → redirect to /dashboard.

Task 3.8 — Generate app/(auth)/forgot-password/page.tsx
  and app/(auth)/reset-password/page.tsx.

Task 3.9 — Generate app/api/users/me/route.ts:
  GET: return current user profile (no passwordHash).
  PATCH: update name, phone, timezone, avatarUrl.

---

### ── PHASE 4: PAYMENTS ──

Task 4.1 — Generate lib/stripe.ts (server + client instances).
  Generate lib/razorpay.ts.

Task 4.2 — Generate app/api/payments/checkout/route.ts:
  POST: validate tier, check coupon, create Stripe Checkout Session.
  Return { checkoutUrl }.

Task 4.3 — Generate app/api/payments/portal/route.ts:
  POST: create Stripe Customer Portal session. Return { portalUrl }.

Task 4.4 — Generate app/api/payments/coupons/validate/route.ts:
  POST { code, tierId }: validate coupon. Return discount or error reason.

Task 4.5 — Generate app/api/payments/stripe/webhook/route.ts:
  Verify Stripe signature. Handle:
  checkout.session.completed, invoice.payment_succeeded,
  invoice.payment_failed, subscription.updated, subscription.deleted.
  Each event: update DB + push to job queues.

Task 4.6 — Generate app/api/payments/razorpay/order/route.ts
  and app/api/payments/razorpay/verify/route.ts (HMAC verification).

Task 4.7 — Generate jobs/invoice.job.ts:
  pdfkit PDF generation → R2 upload → DB update → email queue.

Task 4.8 — Generate components/payments/CheckoutButton.tsx,
  CouponField.tsx, RazorpayButton.tsx.

---

### ── PHASE 5: EMAIL ──

Task 5.1 — Generate lib/resend.ts — Resend client + sendEmail() helper.

Task 5.2 — Generate emails/WelcomeEmail.tsx and emails/PasswordResetEmail.tsx.

Task 5.3 — Generate emails/InvoiceEmail.tsx and emails/PaymentFailedEmail.tsx.

Task 5.4 — Generate emails/TicketReplyEmail.tsx and emails/SubscriptionRenewalEmail.tsx.

Task 5.5 — Generate jobs/email.job.ts — BullMQ worker that processes the
  email queue and calls the correct Resend template per job type.

Task 5.6 — Generate jobs/worker.ts — bootstrap all BullMQ workers.
  Generate lib/queue.ts — export emailQueue, invoiceQueue, embeddingQueue.

---

### ── PHASE 6: PUBLIC PAGES ──

Task 6.1 — Generate app/(public)/layout.tsx with Navbar + Footer.
  Generate components/layout/Navbar.tsx (auth-aware, mobile responsive).
  Generate components/layout/Footer.tsx (4-column sitemap).

Task 6.2 — Generate app/(public)/page.tsx — Landing page (SSR):
  Hero, Features grid, Stats row, Pricing preview (3 tiers), Testimonials, FAQ, CTA banner.
  Real copy. No Lorem Ipsum.

Task 6.3 — Generate app/(public)/marketplace/page.tsx (SSR):
  Sidebar filters (category, price, rating) + product grid + search + sort.
  Skeleton loading state.

Task 6.4 — Generate components/marketplace/ProductCard.tsx with compare checkbox.
  Generate components/marketplace/ProductCompare.tsx — floating bar + modal.

Task 6.5 — Generate app/(public)/marketplace/[slug]/page.tsx (ISR):
  generateMetadata, generateStaticParams.
  Screenshots carousel, features, pricing tiers, reviews section, sticky sidebar.

Task 6.6 — Generate app/(public)/demo/[sessionId]/page.tsx (CSR):
  Session validation, top bar with timer, template switcher.

Task 6.7 — Generate components/demo/templates/CRMTemplate.tsx:
  Sidebar nav, KPI cards, Kanban pipeline with mock data.

Task 6.8 — Generate components/demo/templates/ChatbotTemplate.tsx:
  Typewriter demo conversation, thinking indicator, quick replies.

Task 6.9 — Generate components/demo/templates/AnalyticsTemplate.tsx:
  Line chart (Recharts), donut chart, top pages table. All from mockDataJson.

Task 6.10 — Generate app/(public)/blog/page.tsx and blog/[slug]/page.tsx (ISR).
  Generate app/sitemap.ts and app/robots.ts.

---

### ── PHASE 7: CLIENT DASHBOARD ──

Task 7.1 — Generate app/(dashboard)/dashboard/layout.tsx:
  Collapsible sidebar, top header with notification bell + avatar menu.
  Mobile: bottom tab bar.

Task 7.2 — Generate app/(dashboard)/dashboard/page.tsx — Overview:
  Stats row (4 cards), quick actions, recent activity feed, subscribed products.

Task 7.3 — Generate app/(dashboard)/dashboard/subscriptions/page.tsx:
  Active subscription cards, manage plan modal, cancel flow, billing history table.

Task 7.4 — Generate app/(dashboard)/dashboard/projects/page.tsx:
  Kanban view toggle. Project cards. Project detail slide-over panel with
  milestones, file upload (R2 presigned URL), comments thread.

Task 7.5 — Generate app/(dashboard)/dashboard/invoices/page.tsx:
  Summary cards, filter bar, invoice table, "Pay Now" modal.

Task 7.6 — Generate app/(dashboard)/dashboard/tickets/page.tsx
  and app/(dashboard)/dashboard/tickets/[id]/page.tsx:
  Ticket list with filters. Create ticket modal (Tiptap editor).
  Ticket detail with threaded messages, Pusher realtime updates.

Task 7.7 — Generate app/(dashboard)/dashboard/chat/page.tsx:
  ChatWindow with Pusher, typing indicators, read receipts, file sharing.

Task 7.8 — Generate app/(dashboard)/dashboard/profile/page.tsx:
  4 tabs: Profile, Security (2FA + sessions), API Keys, Notification preferences.

---

### ── PHASE 8: ADMIN & CRM ──

Task 8.1 — Generate app/(admin)/admin/layout.tsx:
  Dark sidebar, role badge, "View as Client" impersonation toggle.

Task 8.2 — Generate app/(admin)/admin/page.tsx — KPI overview:
  MRR, ARR, churn, signups, revenue AreaChart (Recharts), activity feed.

Task 8.3 — Generate app/(admin)/admin/users/page.tsx:
  Searchable table, role editor, bulk actions, user detail slide-over.

Task 8.4 — Generate app/(admin)/admin/products/page.tsx:
  Product table + full create/edit form (Tiptap, image upload, pricing tiers, Stripe sync).

Task 8.5 — Generate app/(admin)/admin/crm/page.tsx:
  4 tabs: Pipeline (Kanban drag-drop), Leads table (import/export CSV),
  Email Sequences builder, Analytics charts.

Task 8.6 — Generate app/(admin)/admin/audit/page.tsx:
  Filterable audit log table, JSON diff viewer modal, CSV export.

---

### ── PHASE 9: AI FEATURES ──

Task 9.1 — Generate lib/openai.ts:
  OpenAI client with exponential backoff retry (max 3 attempts).
  streamChat(), generateEmbedding() helpers.

Task 9.2 — Generate app/api/ai/chat/route.ts (streaming):
  Redis conversation history, GPT-4o streaming, auto-escalate to ticket.

Task 9.3 — Generate components/shared/ChatbotWidget.tsx:
  Floating button, chat popup, streaming message display,
  "Talk to Human" button.

Task 9.4 — Generate app/api/ai/recommendations/route.ts:
  pgvector cosine similarity query, exclude subscribed products.

Task 9.5 — Generate jobs/embedding.job.ts:
  Process product and user embedding jobs, store vector in DB.

Task 9.6 — Generate app/api/ai/agents/[id]/invoke/route.ts:
  Auth check, subscription check, streaming OpenAI call, MongoDB log.

---

### ── PHASE 10: NOTIFICATIONS & REALTIME ──

Task 10.1 — Generate lib/pusher.ts (server + client instances).

Task 10.2 — Generate lib/notifications.ts:
  createNotification() — DB insert + Pusher trigger.

Task 10.3 — Generate app/api/notifications/route.ts (GET list, PATCH mark-read).

Task 10.4 — Generate hooks/useNotifications.ts:
  Pusher subscription, Zustand store update, unread count.

Task 10.5 — Generate components/shared/NotificationBell.tsx:
  Badge with count, dropdown list, "Mark all read" button.

---

### ── PHASE 11: FILE UPLOADS ──

Task 11.1 — Generate lib/r2.ts:
  Cloudflare R2 client (AWS SDK v3 compatible).
  generatePresignedPutUrl(), generatePresignedGetUrl().

Task 11.2 — Generate app/api/upload/signed-url/route.ts:
  Auth required. MIME + size validation. Return { uploadUrl, publicUrl }.

Task 11.3 — Generate components/shared/FileUploader.tsx:
  Drag-and-drop, progress bar, calls signed URL API,
  uploads directly to R2, returns public URL.

---

### ── PHASE 12: FINAL ──

Task 12.1 — Generate lib/encryption.ts:
  AES-256-GCM encrypt() and decrypt() using Node crypto.

Task 12.2 — Generate app/api/health/route.ts:
  Check DB, Redis connectivity. Return { status, db, redis, timestamp }.

Task 12.3 — Generate Procfile and package.json scripts for Railway:
  web, worker processes. db:push, db:seed, build scripts.

Task 12.4 — Generate README.md:
  Local setup in 5 commands. Railway deploy in 3 steps.
  All env vars documented with where to get each one.

---

## ⚙️ HOW TO USE

Step 1: Paste the MASTER CONTROL PROMPT above as your first Lovable message.
Step 2: Wait for Lovable to reply "Ready. Waiting for Task 1.1."
Step 3: Copy-paste ONE task at a time, e.g:
        "Task 1.1 — Create the folder structure only."
Step 4: After Lovable completes it, review, then send the next task.
Step 5: If output is wrong, say: "Fix [specific issue] in [file]. Do not touch other files."
Step 6: Never say "continue" or "build the rest" — always name the exact task.

## 🚨 EMERGENCY RESETS
If Lovable goes off track:
  "Stop. Do not generate anything else. Wait for my next task instruction."

If it generates too much at once:
  "Revert to just Task X.Y. Delete everything generated after that."

If it forgets the stack:
  "Reminder: stack is locked. Next.js 14 full-stack only. No Express. No MongoDB.
   Now continue with Task X.Y."
