# Start Client Portal & Digital Marketplace

A comprehensive, full-stack client portal and digital marketplace ecosystem built with Next.js, TypeScript, Tailwind CSS, Prisma, and Clerk. The platform enables seamless management of digital products, SaaS offerings, AI agents, custom services, automated workflows, subscription billing, and multi-role operations.

---

## 🌟 Key Features

- **Multi-Role System**: Roles for Super Admin, Sub Admin, Vendor, Client, and Guest with fine-grained access control.
- **Digital & AI Marketplace**: Catalog supporting SaaS, AI Agents, AI Tools, Custom Services, Digital Downloads, Cloud Services, and Credit Packs.
- **Authentication & Auth Security**: Managed via Clerk with integration for session handling, RBAC, and protected client/admin dashboards.
- **Flexible Billing & Payments**: Multi-gateway support using **Stripe** and **Razorpay** supporting one-time payments, subscriptions, seat-based billing, and credit packs.
- **AI & Vector Capabilities**: Integrated with OpenAI API and PostgreSQL `pgvector` for smart search and AI-assisted workflows.
- **Background Processing & Queues**: Distributed background job processing using BullMQ, Redis, and custom background workers.
- **Real-Time Communication**: Pusher integration for real-time notifications, status updates, and interactive features.
- **Storage & Media Handling**: AWS S3 integration with presigned URLs for safe file uploads and asset management.
- **Email Notifications**: Responsive transactional emails built with React Email and dispatched via Resend and Nodemailer.
- **Observability & Logging**: Integrated error tracking using Sentry and structured logging using Pino.

---

## 🚀 Tech Stack

### Frontend & UI
- **Framework**: Next.js (App Router, Turbopack, React 18, TypeScript)
- **Styling**: Tailwind CSS, CSS Animations (`tailwindcss-animate`)
- **UI Components**: Radix UI Primitives, Lucide Icons, Heroicons
- **Animations**: Framer Motion
- **State & Forms**: React Hook Form, Zod, Zustand
- **Notifications**: Sonner

### Backend & Database
- **Language & Runtime**: Node.js, TypeScript (`ts-node`, `tsx`)
- **Database**: PostgreSQL with `pgvector` extension
- **ORM**: Prisma ORM
- **Authentication**: Clerk (`@clerk/nextjs`, `@clerk/clerk-react`)
- **Caching & Rate Limiting**: Redis (`ioredis`), Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`)
- **Queue System**: BullMQ

### Payments, Storage & Integrations
- **Payments**: Stripe (`stripe`, `@stripe/stripe-js`), Razorpay
- **Storage**: AWS S3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **AI Models**: OpenAI API
- **Real-time**: Pusher (`pusher`, `pusher-js`)
- **Email**: Resend, React Email, Nodemailer
- **Monitoring**: Sentry (`@sentry/nextjs`), Pino
- **Web Automation / Scraping**: Puppeteer

### Infrastructure & DevOps
- **Containerization**: Docker, Docker Compose
- **Web Server / Reverse Proxy**: Nginx
- **Process Management**: Custom worker process (`lib/workers.ts`)

---

## 📁 Project Structure

```text
├── app/                  # Next.js App Router (Routes: (admin), (auth), (dashboard), (public), api, etc.)
├── components/           # Reusable UI & Feature components
├── emails/               # React Email templates
├── hooks/                # Custom React hooks
├── jobs/                 # Queue jobs & background tasks
├── lib/                  # Utility libraries, worker setups, DB clients
├── prisma/               # Prisma schema and database migrations
├── providers/            # React context providers
├── public/               # Static assets
├── scripts/              # Helper & database seed scripts
├── stores/               # State management (Zustand)
├── types/                # TypeScript type definitions
├── docker-compose.yml    # Local services (Postgres, Redis, Nginx)
├── Dockerfile            # Container configuration
└── nginx.conf            # Nginx proxy configuration
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v20+ recommended
- **Package Manager**: npm
- **Database**: PostgreSQL (with `pgvector` enabled)
- **Redis**: Local or cloud Redis instance (for background jobs & caching)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd start-client
npm install
```

### 2. Environment Variables

Copy the example environment file and configure the required environment variables:

```bash
cp .env.example .env
```

Ensure the following key configurations are set in `.env`:
- `DATABASE_URL` & `DIRECT_URL` (PostgreSQL)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`
- `REDIS_URL` / `UPSTASH_REDIS_REST_URL`
- `STRIPE_SECRET_KEY` & `RAZORPAY_KEY_SECRET`
- `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### 3. Database Migration & Setup

Generate Prisma Client and apply migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed      # Optional: seed initial data
```

### 4. Running the Development Server

Start Next.js development server:

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### 5. Running Background Workers

Start the BullMQ background queue workers in a separate terminal:

```bash
npm run workers
```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server |
| `npm run build` | Builds production bundle |
| `npm run start` | Starts production server |
| `npm run workers` | Runs background BullMQ worker process |
| `npm run jobs:schedule` | Schedules recurring cron jobs |
| `npm run db:generate` | Generates Prisma client |
| `npm run db:migrate` | Runs Prisma database migrations (dev) |
| `npm run db:studio` | Opens Prisma Studio GUI |
| `npm run email:dev` | Opens React Email dev server preview |
| `npm run lint` | Runs ESLint checks |
| `npm run type-check` | Runs TypeScript type checking |

---

## 🛡️ License

Private & Proprietary codebase.
