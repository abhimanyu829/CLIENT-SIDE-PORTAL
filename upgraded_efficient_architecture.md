# ⚡ UPGRADED ARCHITECTURE — Production SaaS + AI Marketplace
# Strong · Efficient · Battle-Tested · No Over-Engineering
# ─────────────────────────────────────────────────────────

## WHY THIS UPGRADE?
The previous architecture had 12+ services, 3 databases, Turborepo, Kafka,
and AWS ECS — overkill for a startup. This version uses fewer moving parts,
the same production power, and ships 2x faster.

## ARCHITECTURE PHILOSOPHY
  OLD: Microservices + Turborepo + MongoDB + Express + ECS + Kafka
  NEW: Modular Monolith + Next.js full-stack + PostgreSQL only + Railway/Render

  Rule: Add complexity only when you've proven you need it.
  A modular monolith that's well-structured beats a distributed system
  that's hard to debug, deploy, and maintain at early scale.

---

## 🛠 UPGRADED TECH STACK

| Layer          | OLD (Over-engineered)        | NEW (Efficient)               | Why                          |
|----------------|------------------------------|-------------------------------|------------------------------|
| Framework      | Next.js + Express (2 apps)   | Next.js 14 (full-stack)       | API routes handle backend     |
| Monorepo       | Turborepo (complex)          | Single Next.js app            | Ship faster, debug easier     |
| Primary DB     | PostgreSQL + MongoDB + Redis | PostgreSQL + Redis only        | Postgres handles everything   |
| ORM            | Prisma                       | Prisma (kept)                 | Best-in-class, type-safe      |
| Auth           | NextAuth v5 + custom JWT     | NextAuth v5 (kept)            | Battle-tested, simpler        |
| Queue/Jobs     | Kafka / RabbitMQ             | BullMQ + Redis                | Redis you already have        |
| Email          | Resend (kept)                | Resend (kept)                 | Reliable, generous free tier  |
| Payments       | Stripe + Razorpay (kept)     | Stripe + Razorpay (kept)      | No change needed              |
| Storage        | AWS S3 + CloudFront          | Cloudflare R2 + CDN           | 0 egress cost, S3-compatible  |
| Realtime       | Socket.io                    | Pusher / Ably (managed)       | No server to maintain         |
| AI             | OpenAI + pgvector             | OpenAI + pgvector (kept)      | pgvector is now stable        |
| Deployment     | AWS ECS + Terraform           | Railway or Render             | Deploy in minutes, not days   |
| CI/CD          | GitHub Actions → ECR → ECS   | GitHub Actions → Railway      | Same pipeline, simpler target |
| State          | Zustand + React Query        | Zustand + React Query (kept)  | Perfect combination           |
| Logging        | Pino                         | Pino (kept)                   | Fast structured logging       |

---

## 📁 NEW FOLDER STRUCTURE (Single Next.js App — clean & modular)

```
saas-platform/
├── app/                          # Next.js App Router
│   ├── (public)/                 # No auth required
│   │   ├── page.tsx              # Landing (SSR)
│   │   ├── marketplace/
│   │   │   ├── page.tsx          # Product listing (SSR)
│   │   │   └── [slug]/page.tsx   # Product detail (ISR)
│   │   ├── ai-agents/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── demo/[sessionId]/page.tsx
│   │   └── blog/
│   │       ├── page.tsx
│   │       └── [slug]/page.tsx
│   │
│   ├── (auth)/                   # Auth pages
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   │
│   ├── (dashboard)/              # CLIENT protected
│   │   └── dashboard/
│   │       ├── layout.tsx
│   │       ├── page.tsx          # Overview
│   │       ├── subscriptions/page.tsx
│   │       ├── projects/page.tsx
│   │       ├── invoices/page.tsx
│   │       ├── tickets/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── chat/page.tsx
│   │       └── profile/page.tsx
│   │
│   ├── (admin)/                  # SUB_ADMIN + SUPER_ADMIN protected
│   │   └── admin/
│   │       ├── layout.tsx
│   │       ├── page.tsx          # KPI overview
│   │       ├── users/page.tsx
│   │       ├── products/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── crm/page.tsx
│   │       └── audit/page.tsx
│   │
│   └── api/                      # All backend logic lives here
│       ├── auth/[...nextauth]/route.ts
│       ├── users/
│       │   ├── route.ts           # GET list (admin), POST create
│       │   ├── me/route.ts        # GET/PATCH current user
│       │   └── [id]/route.ts
│       ├── products/
│       │   ├── route.ts
│       │   └── [slug]/route.ts
│       ├── subscriptions/route.ts
│       ├── payments/
│       │   ├── checkout/route.ts
│       │   ├── portal/route.ts
│       │   ├── stripe/webhook/route.ts
│       │   ├── razorpay/order/route.ts
│       │   ├── razorpay/verify/route.ts
│       │   └── razorpay/webhook/route.ts
│       ├── coupons/validate/route.ts
│       ├── invoices/
│       │   ├── route.ts
│       │   └── [id]/download/route.ts
│       ├── projects/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── tickets/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── messages/route.ts
│       ├── leads/route.ts
│       ├── ai/
│       │   ├── chat/route.ts          # GPT-4o chatbot (streaming)
│       │   ├── agents/[id]/invoke/route.ts
│       │   └── recommendations/route.ts
│       ├── demos/
│       │   ├── create/route.ts
│       │   └── [sessionId]/route.ts
│       ├── notifications/
│       │   ├── route.ts
│       │   └── sse/route.ts           # Server-Sent Events
│       ├── analytics/route.ts
│       └── upload/route.ts            # S3/R2 signed URL generator
│
├── components/
│   ├── ui/                       # Shadcn/UI base components
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── DashboardSidebar.tsx
│   │   ├── AdminSidebar.tsx
│   │   └── ThemeToggle.tsx
│   ├── marketing/
│   │   ├── HeroSection.tsx
│   │   ├── FeaturesGrid.tsx
│   │   ├── PricingCards.tsx
│   │   ├── TestimonialCarousel.tsx
│   │   └── FAQAccordion.tsx
│   ├── marketplace/
│   │   ├── ProductCard.tsx
│   │   ├── ProductFilters.tsx
│   │   ├── ProductCompare.tsx
│   │   └── ProductSearch.tsx
│   ├── demo/
│   │   ├── DemoTimer.tsx
│   │   └── templates/
│   │       ├── CRMTemplate.tsx
│   │       ├── ChatbotTemplate.tsx
│   │       └── AnalyticsTemplate.tsx
│   ├── dashboard/
│   │   ├── StatsRow.tsx
│   │   ├── SubscriptionCard.tsx
│   │   ├── KanbanBoard.tsx
│   │   ├── InvoiceTable.tsx
│   │   ├── TicketList.tsx
│   │   └── ChatWindow.tsx
│   ├── admin/
│   │   ├── KPICard.tsx
│   │   ├── UserTable.tsx
│   │   ├── CRMPipeline.tsx
│   │   └── AuditViewer.tsx
│   ├── payments/
│   │   ├── CheckoutButton.tsx
│   │   ├── CouponField.tsx
│   │   └── RazorpayButton.tsx
│   └── shared/
│       ├── ChatbotWidget.tsx      # Floating AI chatbot
│       ├── NotificationBell.tsx
│       ├── FileUploader.tsx
│       └── RichTextEditor.tsx     # Tiptap wrapper
│
├── lib/                           # All server + client utilities
│   ├── auth.ts                    # NextAuth config
│   ├── db.ts                      # Prisma singleton
│   ├── redis.ts                   # Upstash Redis client
│   ├── queue.ts                   # BullMQ queue definitions
│   ├── stripe.ts                  # Stripe client
│   ├── razorpay.ts                # Razorpay client
│   ├── r2.ts                      # Cloudflare R2 (S3-compatible) client
│   ├── resend.ts                  # Email client
│   ├── openai.ts                  # OpenAI client with retry
│   ├── pusher.ts                  # Pusher realtime client
│   ├── encryption.ts              # AES-256-GCM encrypt/decrypt
│   ├── env.ts                     # Zod env validation
│   ├── audit.ts                   # Audit log helper
│   ├── permissions.ts             # RBAC permission checker
│   └── utils.ts                   # cn(), formatCurrency(), etc.
│
├── hooks/
│   ├── useAuth.ts
│   ├── useSubscription.ts
│   ├── useNotifications.ts        # Pusher hook
│   ├── useDebounce.ts
│   └── useFileUpload.ts
│
├── stores/
│   ├── authStore.ts               # Zustand
│   ├── cartStore.ts
│   └── notifStore.ts
│
├── types/
│   ├── api.ts                     # ApiResponse<T>
│   ├── auth.ts
│   ├── product.ts
│   ├── payment.ts
│   └── crm.ts
│
├── emails/                        # React Email templates
│   ├── WelcomeEmail.tsx
│   ├── InvoiceEmail.tsx
│   ├── TicketReplyEmail.tsx
│   ├── PaymentFailedEmail.tsx
│   ├── SubscriptionRenewalEmail.tsx
│   └── PasswordResetEmail.tsx
│
├── jobs/                          # BullMQ background workers
│   ├── worker.ts                  # Worker bootstrap
│   ├── email.job.ts               # Send emails async
│   ├── invoice.job.ts             # Generate + upload PDF
│   ├── embedding.job.ts           # Generate AI embeddings
│   └── demo-expire.job.ts         # Expire demo sessions
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── middleware.ts                  # Next.js edge middleware
├── next.config.js
├── tailwind.config.ts
├── .env.example
└── README.md
```

---

## 🗄 SINGLE DATABASE APPROACH (PostgreSQL only — no MongoDB)

MongoDB was used only for logs and chat. PostgreSQL handles both perfectly.
This removes an entire database, its connection pool, and its complexity.

```prisma
// ── ENUMS ──────────────────────────────────────────────────

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

enum Role            { SUPER_ADMIN SUB_ADMIN CLIENT GUEST }
enum Department      { TECH MARKETING FINANCE AI OPERATIONS }
enum ProductType     { SAAS SERVICE AI_AGENT CUSTOM }
enum ProductStatus   { DRAFT PUBLISHED ARCHIVED }
enum BillingInterval { MONTHLY YEARLY ONE_TIME }
enum SubStatus       { ACTIVE CANCELLED PAST_DUE TRIALING PAUSED }
enum PaymentStatus   { PENDING SUCCESS FAILED REFUNDED }
enum PaymentGateway  { STRIPE RAZORPAY }
enum ProjectStatus   { PENDING ACTIVE REVIEW COMPLETED CANCELLED }
enum TicketPriority  { LOW MEDIUM HIGH CRITICAL }
enum TicketStatus    { OPEN IN_PROGRESS RESOLVED CLOSED }
enum LeadStage       { NEW CONTACTED QUALIFIED PROPOSAL NEGOTIATION WON LOST }
enum NotifType       { PAYMENT TICKET SUBSCRIPTION PROJECT SYSTEM CHAT }
enum CouponType      { PERCENTAGE FLAT }

// ── CORE MODELS ───────────────────────────────────────────

model User {
  id               String     @id @default(cuid())
  email            String     @unique
  name             String
  passwordHash     String?
  role             Role       @default(CLIENT)
  department       Department?
  avatarUrl        String?
  phone            String?
  timezone         String     @default("Asia/Kolkata")
  isVerified       Boolean    @default(false)
  twoFactorEnabled Boolean    @default(false)
  twoFactorSecret  String?
  stripeCustomerId String?    @unique
  lastLoginAt      DateTime?
  notifPrefs       Json       @default("{}")   // { email: true, inApp: true, whatsapp: false }
  embedding        Unsupported("vector(1536)")?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  permissions     UserPermission[]
  subscriptions   Subscription[]
  payments        Payment[]
  clientProjects  Project[]       @relation("ClientProjects")
  managedProjects Project[]       @relation("ManagerProjects")
  clientTickets   Ticket[]        @relation("ClientTickets")
  assignedTickets Ticket[]        @relation("AssignedTickets")
  invoices        Invoice[]
  notifications   Notification[]
  reviews         ProductReview[]
  auditLogs       AuditLog[]
  leads           Lead[]          @relation("AssignedLeads")
  apiKeys         ApiKey[]
  sessions        UserSession[]
  chatMessages    ChatMessage[]

  @@index([email])
  @@index([role])
  @@index([createdAt])
}

model Permission {
  id          String           @id @default(cuid())
  name        String           @unique   // "manage:products"
  action      String
  resource    String
  description String?
  users       UserPermission[]
  @@index([action, resource])
}

model UserPermission {
  userId       String
  permissionId String
  grantedAt    DateTime   @default(now())
  grantedBy    String?
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id])
  @@id([userId, permissionId])
}

model UserSession {
  id           String   @id @default(cuid())
  userId       String
  sessionToken String   @unique
  ipAddress    String?
  userAgent    String?
  lastActiveAt DateTime @default(now())
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([expiresAt])
}

model ApiKey {
  id         String    @id @default(cuid())
  userId     String
  name       String
  keyHash    String    @unique
  prefix     String
  lastUsedAt DateTime?
  expiresAt  DateTime?
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

// ── PRODUCT MODELS ────────────────────────────────────────

model Product {
  id             String        @id @default(cuid())
  slug           String        @unique
  name           String
  tagline        String
  description    String
  type           ProductType
  status         ProductStatus @default(DRAFT)
  thumbnailUrl   String?
  screenshotUrls String[]
  demoTemplateId String?
  features       Json          // [{ icon, title, description }]
  techStack      String[]
  averageRating  Float         @default(0)
  reviewCount    Int           @default(0)
  viewCount      Int           @default(0)
  createdBy      String
  embedding      Unsupported("vector(1536)")?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  tiers        ProductTier[]
  reviews      ProductReview[]
  demoSessions DemoSession[]
  subscriptions Subscription[]

  @@index([slug])
  @@index([type, status])
  @@index([averageRating])
}

model ProductTier {
  id             String          @id @default(cuid())
  productId      String
  name           String
  price          Decimal
  currency       String          @default("USD")
  interval       BillingInterval
  features       String[]
  limits         Json?
  isPopular      Boolean         @default(false)
  isActive       Boolean         @default(true)
  stripePriceId  String?
  razorpayPlanId String?
  sortOrder      Int             @default(0)
  createdAt      DateTime        @default(now())
  product        Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  subscriptions  Subscription[]
  @@index([productId])
}

// ── BILLING MODELS ────────────────────────────────────────

model Subscription {
  id                 String    @id @default(cuid())
  userId             String
  productId          String
  tierId             String
  status             SubStatus @default(TRIALING)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean   @default(false)
  cancelledAt        DateTime?
  trialEndsAt        DateTime?
  stripeSubId        String?   @unique
  razorpaySubId      String?   @unique
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  user               User      @relation(fields: [userId], references: [id])
  product            Product   @relation(fields: [productId], references: [id])
  tier               ProductTier @relation(fields: [tierId], references: [id])
  payments           Payment[]
  invoices           Invoice[]
  @@index([userId])
  @@index([status])
  @@index([currentPeriodEnd])
}

model Payment {
  id               String        @id @default(cuid())
  subscriptionId   String?
  userId           String
  amount           Decimal
  currency         String        @default("USD")
  status           PaymentStatus @default(PENDING)
  gateway          PaymentGateway
  gatewayPaymentId String?       @unique
  gatewayOrderId   String?
  failureReason    String?
  paidAt           DateTime?
  createdAt        DateTime      @default(now())
  user             User          @relation(fields: [userId], references: [id])
  subscription     Subscription? @relation(fields: [subscriptionId], references: [id])
  invoice          Invoice?
  @@index([userId])
  @@index([status])
}

model Invoice {
  id             String       @id @default(cuid())
  paymentId      String       @unique
  subscriptionId String?
  userId         String
  number         String       @unique
  pdfUrl         String?
  totalAmount    Decimal
  taxAmount      Decimal      @default(0)
  currency       String       @default("USD")
  status         String       @default("PAID")
  lineItems      Json
  issuedAt       DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id])
  payment        Payment      @relation(fields: [paymentId], references: [id])
  subscription   Subscription? @relation(fields: [subscriptionId], references: [id])
  @@index([userId])
  @@index([number])
}

model Coupon {
  id            String     @id @default(cuid())
  code          String     @unique
  type          CouponType
  discountValue Decimal
  currency      String?
  maxUses       Int?
  usedCount     Int        @default(0)
  applicableTierIds String[]
  expiresAt     DateTime?
  isActive      Boolean    @default(true)
  createdAt     DateTime   @default(now())
  @@index([code])
}

// ── PROJECT & SUPPORT MODELS ──────────────────────────────

model Project {
  id          String        @id @default(cuid())
  clientId    String
  managerId   String?
  title       String
  description String
  status      ProjectStatus @default(PENDING)
  deadline    DateTime?
  budget      Decimal?
  currency    String        @default("USD")
  milestones  Json          // [{ title, dueDate, completed }]
  tags        String[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  client      User          @relation("ClientProjects", fields: [clientId], references: [id])
  manager     User?         @relation("ManagerProjects", fields: [managerId], references: [id])
  tickets     Ticket[]
  files       ProjectFile[]
  @@index([clientId])
  @@index([status])
}

model ProjectFile {
  id         String   @id @default(cuid())
  projectId  String
  uploadedBy String
  name       String
  url        String
  size       Int
  mimeType   String
  createdAt  DateTime @default(now())
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@index([projectId])
}

model Ticket {
  id          String         @id @default(cuid())
  projectId   String?
  clientId    String
  assignedTo  String?
  title       String
  description String
  priority    TicketPriority @default(MEDIUM)
  status      TicketStatus   @default(OPEN)
  category    String
  resolvedAt  DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  client      User           @relation("ClientTickets", fields: [clientId], references: [id])
  assignee    User?          @relation("AssignedTickets", fields: [assignedTo], references: [id])
  project     Project?       @relation(fields: [projectId], references: [id])
  messages    TicketMessage[]
  @@index([clientId])
  @@index([status, priority])
}

model TicketMessage {
  id          String   @id @default(cuid())
  ticketId    String
  senderId    String
  content     String
  attachments Json     @default("[]")
  isInternal  Boolean  @default(false)
  createdAt   DateTime @default(now())
  ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  @@index([ticketId])
}

// ── CHAT MODELS (replaces MongoDB) ────────────────────────

model ChatRoom {
  id        String        @id @default(cuid())
  userId    String
  agentId   String?
  isActive  Boolean       @default(true)
  createdAt DateTime      @default(now())
  messages  ChatMessage[]
  @@index([userId])
}

model ChatMessage {
  id         String   @id @default(cuid())
  roomId     String
  senderId   String
  senderType String   // "USER" | "AGENT" | "BOT"
  content    String
  fileUrl    String?
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
  room       ChatRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)
  sender     User     @relation(fields: [senderId], references: [id])
  @@index([roomId])
  @@index([createdAt])
}

// ── CRM MODELS ────────────────────────────────────────────

model Lead {
  id              String    @id @default(cuid())
  email           String
  name            String?
  phone           String?
  company         String?
  source          String    // WEBSITE, REFERRAL, SOCIAL, etc.
  stage           LeadStage @default(NEW)
  score           Int       @default(0)
  assignedTo      String?
  notes           String?
  convertedAt     DateTime?
  convertedUserId String?
  metadata        Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  assignee        User?     @relation("AssignedLeads", fields: [assignedTo], references: [id])
  interactions    LeadInteraction[]
  emailSequences  EmailSequence[]
  @@index([stage, score])
  @@index([email])
}

model LeadInteraction {
  id        String   @id @default(cuid())
  leadId    String
  userId    String
  type      String   // EMAIL, CALL, MEETING, NOTE
  summary   String
  createdAt DateTime @default(now())
  lead      Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  @@index([leadId])
}

model EmailSequence {
  id          String    @id @default(cuid())
  leadId      String
  name        String
  steps       Json      // [{ subject, body, delayDays, sentAt?, status }]
  currentStep Int       @default(0)
  isActive    Boolean   @default(true)
  nextSendAt  DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  lead        Lead      @relation(fields: [leadId], references: [id], onDelete: Cascade)
  @@index([nextSendAt])
}

// ── AI & DEMO MODELS ──────────────────────────────────────

model AIAgent {
  id            String   @id @default(cuid())
  slug          String   @unique
  name          String
  category      String
  description   String
  capabilities  String[]
  apiEndpoint   String?
  configSchema  Json
  pricingModel  String
  callPrice     Decimal?
  isActive      Boolean  @default(true)
  thumbnailUrl  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([category, isActive])
}

model DemoSession {
  id           String   @id @default(cuid())
  productId    String
  userId       String?
  templateId   String
  sessionToken String   @unique
  mockDataJson Json
  isExpired    Boolean  @default(false)
  convertedAt  DateTime?
  startedAt    DateTime @default(now())
  expiresAt    DateTime
  product      Product  @relation(fields: [productId], references: [id])
  @@index([sessionToken])
  @@index([expiresAt])
}

// ── CONTENT MODELS ────────────────────────────────────────

model ProductReview {
  id           String   @id @default(cuid())
  productId    String
  userId       String
  rating       Int
  title        String
  body         String
  isVerified   Boolean  @default(false)
  helpfulCount Int      @default(0)
  createdAt    DateTime @default(now())
  product      Product  @relation(fields: [productId], references: [id])
  user         User     @relation(fields: [userId], references: [id])
  @@unique([productId, userId])
  @@index([productId, rating])
}

model BlogPost {
  id            String    @id @default(cuid())
  slug          String    @unique
  title         String
  excerpt       String
  contentMdx    String
  coverImageUrl String?
  authorId      String
  publishedAt   DateTime?
  tags          String[]
  readingTime   Int
  viewCount     Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@index([slug])
  @@index([publishedAt])
}

// ── SYSTEM MODELS ─────────────────────────────────────────

model Notification {
  id        String    @id @default(cuid())
  userId    String
  type      NotifType
  title     String
  body      String
  isRead    Boolean   @default(false)
  actionUrl String?
  metadata  Json?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, isRead])
  @@index([createdAt])
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String
  entity     String?
  entityId   String?
  beforeJson Json?
  afterJson  Json?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())
  user       User?    @relation(fields: [userId], references: [id])
  @@index([userId])
  @@index([action])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

---

## 🔁 BACKGROUND JOBS (BullMQ — replaces Kafka)

```typescript
// lib/queue.ts — define all queues
import { Queue } from "bullmq"
import { redis } from "./redis"

export const emailQueue    = new Queue("email",    { connection: redis })
export const invoiceQueue  = new Queue("invoice",  { connection: redis })
export const embeddingQueue= new Queue("embedding",{ connection: redis })
export const demoQueue     = new Queue("demo",     { connection: redis })

// jobs/worker.ts — single worker file, run as separate process
import { Worker } from "bullmq"
import { processEmail }     from "./email.job"
import { processInvoice }   from "./invoice.job"
import { processEmbedding } from "./embedding.job"
import { processDemoExpiry }from "./demo-expire.job"

new Worker("email",    processEmail,    { connection: redis, concurrency: 5 })
new Worker("invoice",  processInvoice,  { connection: redis, concurrency: 3 })
new Worker("embedding",processEmbedding,{ connection: redis, concurrency: 2 })
new Worker("demo",     processDemoExpiry,{connection: redis, concurrency: 10 })
```

---

## ⚡ REALTIME (Pusher — replaces Socket.io server)

```typescript
// lib/pusher.ts
import Pusher from "pusher"
import PusherClient from "pusher-js"

// Server: trigger events
export const pusherServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true
})

// Client: subscribe to channels
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! }
)

// Channel naming conventions:
// private-user-{userId}      → notifications, subscription updates
// private-ticket-{ticketId}  → ticket messages
// private-chat-{roomId}      → live chat messages
```

---

## ☁️ DEPLOYMENT (Railway — replaces AWS ECS + Terraform)

```yaml
# railway.toml — deploy Next.js + Worker in one repo
[build]
  builder = "NIXPACKS"

[deploy]
  startCommand = "npm run start"
  healthcheckPath = "/api/health"
  healthcheckTimeout = 30
  restartPolicyType = "ON_FAILURE"
  restartPolicyMaxRetries = 3

# Services to create in Railway dashboard:
# 1. Web service    — runs Next.js app (npm start)
# 2. Worker service — runs BullMQ workers (npm run worker)
# 3. PostgreSQL     — Railway managed Postgres (with pgvector)
# 4. Redis          — Railway managed Redis OR Upstash free tier
```

---

## 🔐 ENV VARIABLES (.env.example)

```bash
# DATABASE (Railway provides this automatically)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# AUTH
NEXTAUTH_URL=https://yourapp.railway.app
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# PAYMENTS
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
RAZORPAY_KEY_ID=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# CLOUDFLARE R2 (S3-compatible, zero egress cost)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
NEXT_PUBLIC_R2_PUBLIC_URL=

# EMAIL
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

# AI
OPENAI_API_KEY=

# REALTIME
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=ap2
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=ap2

# WHATSAPP (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=

# ENCRYPTION
ENCRYPTION_KEY=   # 32-byte hex string

# APP
NEXT_PUBLIC_APP_URL=https://yourapp.railway.app
NODE_ENV=production
```

---

## 📋 FULL LOVABLE PROMPT (paste as single message)

```
ROLE: Senior full-stack engineer building a production SaaS + AI Marketplace.
NOT a prototype. Production-ready, typed, modular, no stubs, no TODOs.

TECH STACK (LOCKED):
- Next.js 14 App Router (full-stack — no separate Express server)
- TypeScript strict, Tailwind CSS, Shadcn/UI
- Prisma + PostgreSQL (single database — no MongoDB)
- Redis/Upstash (cache + rate limiting + BullMQ queues)
- NextAuth.js v5 (JWT + Google + GitHub OAuth)
- BullMQ (background jobs: emails, invoices, embeddings)
- Pusher (realtime — no self-hosted Socket.io)
- Stripe (USD) + Razorpay (INR)
- Cloudflare R2 (file storage — S3-compatible, zero egress cost)
- Resend (transactional email + React Email templates)
- OpenAI GPT-4o + pgvector (AI chat + recommendations)
- Zustand (client state) + React Query (server state)
- react-hook-form + Zod (all forms and API validation)
- Pino (structured logging)
- Railway (deployment — no AWS/Terraform needed)

UNIVERSAL RULES:
1. TypeScript strict — no `any`
2. API contract: { success, data?, error?: { code, message }, meta? }
3. No hardcoded secrets — all env vars validated by Zod at startup
4. No console.log — use Pino logger
5. Mobile-first, dark mode on every component (next-themes)
6. Server Components default, "use client" only when needed
7. All forms: react-hook-form + Zod
8. Cursor-based pagination for all lists
9. Audit log on every CREATE, UPDATE, DELETE

FOLDER STRUCTURE: Single Next.js app (no monorepo).
app/(public)/   — landing, marketplace, demo, blog
app/(auth)/     — login, register, forgot/reset password
app/(dashboard)/ — client protected routes
app/(admin)/    — admin protected routes
app/api/        — ALL backend logic as Next.js route handlers

DATABASE: Single PostgreSQL database via Prisma.
No MongoDB. Chat messages stored in ChatRoom + ChatMessage tables.
No Redis for session data — use NextAuth JWT sessions.
Redis only for: rate limiting, BullMQ queues, AI chat history (TTL 1h).

BACKGROUND JOBS (BullMQ workers in jobs/worker.ts):
- email.job     — send all emails async (never block API response)
- invoice.job   — generate PDF with pdfkit, upload to R2, update DB
- embedding.job — OpenAI embeddings for products and users (pgvector)
- demo.job      — mark expired demo sessions every 5 minutes

REALTIME (Pusher):
- private-user-{userId}: notifications, subscription events
- private-ticket-{ticketId}: ticket messages
- private-chat-{roomId}: live support chat

GENERATE IN THIS ORDER:
1. Complete folder structure with every file path listed
2. .env.example with all keys
3. lib/env.ts Zod validation (crashes on startup if key missing)
4. prisma/schema.prisma (full schema with pgvector extension)
5. prisma/seed.ts (admin, sub-admins, clients, products, leads)
6. lib/ utilities (db, redis, queue, stripe, razorpay, r2, resend, openai, pusher, encryption, auth)
7. middleware.ts (auth guard + RBAC + rate limiting)
8. app/api/ routes (all endpoints)
9. Email templates in emails/ (6 templates with React Email)
10. jobs/worker.ts + all job processors
11. Public pages: landing, marketplace (SSR), product detail (ISR), demo engine, blog
12. Auth pages: login, register, forgot/reset
13. Dashboard layout + all 7 dashboard pages
14. Admin layout + all 5 admin pages (overview, users, products, CRM, audit)
15. Shared components: ChatbotWidget, NotificationBell, FileUploader
16. next.config.js with security headers
17. README.md with setup in 5 commands

─── DETAILED SPECS PER SECTION ───

## API ROUTE PATTERNS
Every route file structure:
  import { NextRequest, NextResponse } from "next/server"
  import { getServerSession } from "next-auth"
  import { authOptions } from "@/lib/auth"
  import { db } from "@/lib/db"
  import { z } from "zod"
  import { logger } from "@/lib/logger"
  import { auditLog } from "@/lib/audit"

  export async function GET(req: NextRequest) {
    try {
      const session = await getServerSession(authOptions)
      // ... business logic
      return NextResponse.json({ success: true, data: result })
    } catch (error) {
      logger.error({ error }, "API error")
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }},
        { status: 500 }
      )
    }
  }

## AUTH SYSTEM
NextAuth v5 with:
- Providers: Credentials (email/password), Google, GitHub
- Strategy: JWT (stored in httpOnly cookie)
- JWT payload: { userId, email, role, permissions[] }
- Session: expiry 7 days, refresh sliding window
- Callbacks: jwt (add role/permissions), session (expose to client)
- Seed: admin@platform.com / Admin@123456

RBAC middleware (middleware.ts):
  /dashboard/* → require role: CLIENT, SUB_ADMIN, SUPER_ADMIN
  /admin/*     → require role: SUB_ADMIN, SUPER_ADMIN
  /api/admin/* → require role: SUB_ADMIN, SUPER_ADMIN
  /api/users/* (mutations) → require SUPER_ADMIN
  Rate limits via Upstash Ratelimit:
    /api/auth/login:     10/15min per IP
    /api/auth/register:  5/1hr per IP
    /api/payments/*:     20/1hr per userId
    /api/ai/*:           50/1hr per userId
    default /api/*:      100/15min per IP

## PAYMENT FLOWS

Stripe (USD):
  POST /api/payments/checkout → create Stripe Checkout Session → return { url }
  POST /api/payments/portal   → Stripe Customer Portal → return { url }
  POST /api/payments/stripe/webhook → verify sig → handle events:
    checkout.session.completed   → create Subscription + Payment + trigger invoice job
    invoice.payment_succeeded    → update Subscription + create Payment + trigger invoice job
    invoice.payment_failed       → update status=PAST_DUE + queue dunning email
    customer.subscription.updated → sync tier + status
    customer.subscription.deleted → status=CANCELLED + notification
    charge.refunded              → status=REFUNDED + notification

Razorpay (INR):
  POST /api/payments/razorpay/order  → create order → return { orderId, amount, keyId }
  POST /api/payments/razorpay/verify → HMAC verify → create Subscription + Payment → trigger invoice job
  POST /api/payments/razorpay/webhook → handle: payment.captured, payment.failed

Invoice job (jobs/invoice.job.ts):
  1. Generate sequential invoice number: INV-{YEAR}-{padded}
  2. Create Invoice record in DB
  3. Build PDF with pdfkit (logo, line items, tax, total)
  4. Upload to R2: invoices/{userId}/{number}.pdf
  5. Update Invoice.pdfUrl
  6. Queue email: send InvoiceEmail with PDF attachment
  7. Push Pusher notification to private-user-{userId}

## DEMO ENGINE
POST /api/demos/create:
  - Create DemoSession (sessionToken = crypto.randomUUID(), expiresAt = now + 30min)
  - Return { sessionId, sessionToken }

GET /api/demos/{sessionId}:
  - Validate token, check expiresAt
  - Return { product, template, mockDataJson, remainingSeconds }

Demo page (/demo/[sessionId]):
  - Client component (CSR)
  - Validates session on mount
  - Shows top bar: product name, DEMO badge, countdown timer (color changes at 5min/1min)
  - Renders template component based on templateId:
    "crm"       → CRMTemplate (kanban pipeline, KPI cards, leads table)
    "chatbot"   → ChatbotTemplate (typewriter demo conversation)
    "analytics" → AnalyticsTemplate (line chart, donut chart, table)
  - At 0: overlay "Demo ended — Start your free trial"
  - "Get Full Access" button in top bar always visible

## AI CHATBOT
POST /api/ai/chat (streaming):
  - Read conversation history from Redis: GET chat:{sessionId}
  - Append user message
  - Call OpenAI with streaming: model=gpt-4o, max_tokens=500
  - Stream response back via ReadableStream
  - Save updated history to Redis (EX 3600)
  - If message contains "human" / "agent" / "help" → create Ticket, return handoff

POST /api/ai/recommendations:
  - Get user embedding from DB (generate if missing)
  - pgvector cosine similarity query on Product.embedding
  - Exclude already-subscribed productIds
  - Return top 6 products

## LIVE CHAT (Pusher)
Chat rooms stored in ChatRoom table (PostgreSQL).
Messages stored in ChatMessage table (replaces MongoDB chat_messages).

POST /api/chat/rooms      → create or get existing room for userId
POST /api/chat/messages   → save message to DB + Pusher trigger to private-chat-{roomId}
GET  /api/chat/rooms/{id}/messages → paginated message history

Client: Pusher subscribe to private-chat-{roomId}, render messages in real-time.

## FILE UPLOADS (Cloudflare R2)
POST /api/upload/signed-url:
  - Auth required
  - Validate file type (MIME allowlist) and size (max 10MB)
  - Generate R2 presigned PUT URL (expires 5 minutes)
  - Return { uploadUrl, publicUrl }
Client uploads directly to R2 using presigned URL (no proxy through Next.js).
After upload, client calls the relevant API to save the URL to DB.

## NOTIFICATION SYSTEM
createNotification (lib/notifications.ts):
  1. INSERT Notification to DB
  2. pusherServer.trigger("private-user-{userId}", "notification:new", { title, body, type })

Client (hooks/useNotifications.ts):
  - Subscribe to Pusher private-user-{userId} channel
  - On "notification:new": update Zustand notifStore, increment badge count

Notification bell component: badge with unread count, dropdown with last 10 notifications.

## SECURITY HEADERS (next.config.js)
Generate with: CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff,
Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy: camera=()

## ENCRYPTION (lib/encryption.ts)
AES-256-GCM for: API keys stored in DB, webhook secrets.
Function signatures: encrypt(text: string): string, decrypt(ciphertext: string): string

## RAILWAY DEPLOYMENT
Generate Procfile:
  web: npm run start
  worker: npm run worker

Generate package.json scripts:
  "start": "next start -p $PORT"
  "worker": "tsx jobs/worker.ts"
  "db:push": "prisma db push"
  "db:seed": "tsx prisma/seed.ts"

Generate README.md:
  Local setup in 5 commands.
  Railway deploy in 3 steps (railway login, railway init, railway up).
  All env vars documented with source (where to get them).

─── OUTPUT ORDER ───
Generate scaffold → schema → seed → lib utilities → middleware → API routes
→ email templates → job workers → public pages → auth pages
→ dashboard pages → admin pages → components → config files → README

Every file must be complete. No placeholders. No stubs. No "// implement this".
```

---

## 📊 ARCHITECTURE COMPARISON

| Metric               | Previous (Complex)     | This Version (Efficient) |
|----------------------|------------------------|--------------------------|
| Total Services       | 3 (web + api + worker) | 2 (web + worker)         |
| Databases            | 3 (PG + Mongo + Redis) | 2 (PG + Redis)           |
| Deployment Complexity| High (ECS + Terraform) | Low (Railway CLI)        |
| Infra cost to start  | ~$200/mo (AWS)         | ~$20/mo (Railway)        |
| Local dev setup time | 30+ minutes            | 5 minutes                |
| Debugging complexity | High (distributed)     | Low (single process)     |
| Feature parity       | 100%                   | 100% (nothing removed)   |
| Scalability ceiling  | Very high              | High (migrate to K8s if needed) |

## ✅ WHEN TO MIGRATE TO PREVIOUS ARCHITECTURE
- Monthly active users > 50,000
- API calls > 10M/month
- Team > 8 engineers
- Need separate deployment cadences per service
- Need different scaling policies per service

Until then — this architecture is the right call.
