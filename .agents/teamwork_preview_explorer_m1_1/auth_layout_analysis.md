# Comprehensive Auth & Layout Analysis Report

**Project**: `c:\Users\Abhimanyu\Desktop\start-client`  
**Target Routes**: `/admin/subscription-center` and `/dashboard/premium`  
**Date**: 2026-07-23  
**Author**: Explorer 1 (Milestone 1 — Subscription & Billing Center)

---

## Executive Summary

The `start-client` codebase features a mature, centralized authentication and role-based access control (RBAC) architecture built on **Clerk** (identity provider), **Prisma PostgreSQL** (user & permission database), and **Next.js 16 App Router**.

Key architectural findings:
1. **Edge Middleware**: Next.js edge request intercepting is managed via `proxy.ts` using `@clerk/nextjs/server`. Matchers cover `/dashboard/:path*`, `/admin/:path*`, and `/api/:path*`. No new `middleware.ts` file should be created.
2. **Server Auth & RBAC**:
   - Client routes use `auth()` or `authState()` from `@/lib/auth`.
   - Admin routes use `requireAdmin()` or `requireSuperAdmin()` from `@/lib/admin-auth`, enforcing zero-trust database role validation.
   - API endpoints use `requireApiAuth()` from `@/lib/api-auth` or `requireAdmin()`.
3. **Layout Wrappers**:
   - `app/(dashboard)/dashboard/layout.tsx` wraps all `/dashboard/*` pages in `<DashboardLayoutClient>`.
   - `app/(admin)/admin/layout.tsx` wraps all `/admin/*` pages in `<AdminLayoutClient>`.
4. **Subscription & Billing Center Integration**:
   - `/admin/subscription-center/page.tsx` will automatically inherit `AdminLayout` and `requireAdmin()`.
   - `/dashboard/premium/page.tsx` will automatically inherit `DashboardLayout` and `auth()`.

---

## 1. Middleware Inspection (`proxy.ts`)

- **File Location**: `proxy.ts` (Root)
- **Role**: Next.js Edge Middleware powered by `@clerk/nextjs/server` (`clerkMiddleware`).

### Detailed Mechanics
- **Matcher Configuration** (`proxy.ts:191-208`):
  ```ts
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/admin-access",
    "/checkout/:path*",
    "/cart/:path*",
    "/login(.*)",
    "/register(.*)",
    "/sso-callback",
    "/sso-callback/:path*",
    "/api/:path*",
    "/request-service",
    "/request-service/:path*",
    "/custom-service",
    "/custom-service/:path*",
  ]
  ```
- **Authentication & Redirect Flow**:
  - Excludes webhooks (`/api/webhooks/clerk`) and SSO callbacks (`/sso-callback`).
  - Implements Upstash Redis rate-limiting on `/api/` endpoints (including `/api/payments/` and `/api/refunds/request`).
  - Calls `await clerkAuth()` to resolve `clerkUserId`.
  - Redirects logged-in users visiting `/login` or `/register` to `/dashboard`.
  - Redirects unauthenticated users accessing `/dashboard/*`, `/admin/*`, `/checkout/*`, or `/cart/*` to `/login?callbackUrl=...`.
  - Returns `401 Unauthorized` JSON for unauthenticated requests to protected `/api/*` endpoints.
- **Admin Permission Scope Headers** (`proxy.ts:36-50`):
  - Injects `x-nexusai-admin-permission-scope: true`, `x-nexusai-admin-resource`, and `x-nexusai-admin-action` headers for `/admin/*` and `/api/admin/*` paths to enable subadmin RBAC checking down the pipeline.

### Integration Rule
> **DO NOT** create a secondary `src/middleware.ts` or add custom auth checks in middleware. `/admin/subscription-center` and `/dashboard/premium` are already matched by `/admin/:path*` and `/dashboard/:path*`.

---

## 2. Auth Session Getters & Database User Sync

### A. Client & Base Auth (`lib/auth.ts`)
- `authState()`: Async helper that calls `currentUser()` from Clerk, syncs user profile to local database via `syncClerkUserToDatabase`, verifies ban status (`isBanned`), and returns:
  ```ts
  type AuthState =
    | { session: AppSession; clerkAuthenticated: true; reason: "OK" }
    | { session: null; clerkAuthenticated: false; reason: "NO_CLERK_SESSION" }
    | { session: null; clerkAuthenticated: true; reason: "BANNED" | "SYNC_FAILED" }
  ```
- `auth()`: Convenient helper returning `AppSession | null`.
  ```ts
  interface AppSession {
    user: {
      id: string
      email: string
      name: string
      role: Role
      isVerified: boolean
      permissions: string[]
      avatarUrl?: string | null
      clerkUserId?: string | null
    }
  }
  ```
- `requireRole(allowedRoles: Role[])`: Zero-trust DB check validating the user's role against allowed Prisma `Role` enums (`SUPER_ADMIN`, `SUB_ADMIN`, `VENDOR`, `CLIENT`, `GUEST`).

### B. Admin Auth & RBAC (`lib/admin-auth.ts`)
- `requireAdmin()`: Zero-trust Server helper for admin pages and Server Actions.
  1. Retrieves session via `auth()`. Redirects to `/login` if unauthenticated.
  2. Queries DB directly for `role` and `isBanned` (`db.user.findUnique`).
  3. Verifies `role === "SUPER_ADMIN" || role === "SUB_ADMIN"`. Redirects to `/unauthorized` if false.
  4. Validates subadmin workforce session (`validateSubadminCredentialSession`). Redirects to `/admin-access` if credential step is required.
  5. For `SUB_ADMIN` roles, validates route request headers against `canUseSubadminPermission`.
  6. Returns `AdminSession`:
     ```ts
     interface AdminSession {
       userId: string
       name: string
       email: string
       role: Role
       isSuperAdmin: boolean
       permissions: SubadminPermission[]
     }
     ```
- `requireSuperAdmin()`: Restricts access strictly to `SUPER_ADMIN` users.
- `requireServicePermission(permissionName)`: Validates granular subadmin permissions or service center grants.

### C. API Auth (`lib/api-auth.ts`)
- `requireApiAuth()`: Returns `session.user.id` or throws `UnauthorizedError`.

---

## 3. Data Model Inspection (`prisma/schema.prisma`)

### User Model Summary (`prisma/schema.prisma:304-395`)
- `id`: String (cuid) — Internal primary key referenced across all domain tables.
- `clerkUserId`: String? @unique — Mapping key connecting Clerk authentication to PostgreSQL.
- `email`: String @unique.
- `role`: Enum `Role` (`SUPER_ADMIN`, `SUB_ADMIN`, `VENDOR`, `CLIENT`, `GUEST`). Default is `CLIENT`.
- `isVerified`: Boolean @default(false) — Enforces email verification before accessing certain features.
- `isBanned`: Boolean @default(false) — Immediate ban flag checked on every request.
- `stripeCustomerId`: String? @unique — Integrates user with Stripe billing.

### Subscription & Commerce Models
- `Subscription` (`lines 806-831`): Belongs to `User`, `Product`, `ProductTier`. Tracks `SubStatus` (`ACTIVE`, `CANCELLED`, `PAST_DUE`, `TRIALING`, `PAUSED`), `currentPeriodStart`, `currentPeriodEnd`, `stripeSubId`, `razorpaySubId`.
- `ProductTier` (`lines 671-721`): Belongs to `Product`. Defines `price`, `interval` (`MONTHLY`, `YEARLY`, `ONE_TIME`, `LIFETIME`, etc.), `stripePriceId`, `razorpayPlanId`, `trialDays`, `features`, `entitlementRules`.
- `CustomerEntitlement` (`lines 1002-1043`): Connects `User` to `Product`/`Subscription`. Tracks active access, API quota, encrypted credential snapshots, and grace periods.

---

## 4. Dashboard & Admin Layout Wrappers

### A. Dashboard Layout (`app/(dashboard)/dashboard/layout.tsx`)
- **Type**: Server Component.
- **Auth Guard**: Calls `authState()`. Redirects unauthenticated users to `/login` and banned users to `/unauthorized`.
- **Client Shell**: `<DashboardLayoutClient>` (`components/dashboard/DashboardLayoutClient.tsx`).
- **Features Provided**:
  - Desktop responsive collapsible sidebar with navigation items (`NAV`).
  - Topbar with Global Search Command Palette (`⌘K`), Notifications dropdown, Live status indicator, User dropdown with Logout, and conditional **Admin Panel** link (`canAccessAdmin`).
  - Verification Alert Banner when `isVerified === false`.
  - Realtime Pusher channel (`useRealtimeChannel`) and Auto Payment Sync (`usePaymentSync`).

### B. Admin Layout (`app/(admin)/admin/layout.tsx`)
- **Type**: Server Component.
- **Auth Guard**: Calls `requireAdmin()`. Zero-trust verification.
- **Client Shell**: `<AdminLayoutClient>` (`components/admin/AdminLayoutClient.tsx`).
- **Features Provided**:
  - Dark mode support, desktop/mobile responsive sidebar filterable by subadmin permissions (`isNavigationAllowed`).
  - Inactivity auto-logout timer (30 minutes).
  - Breadcrumb navigation, User avatar, `RealtimeAdminProvider`, and `Toaster`.

---

## 5. Guide: Clean Extension for Milestone 1 Routes

### Route 1: `/admin/subscription-center`

1. **Page Creation**: Place file at `app/(admin)/admin/subscription-center/page.tsx`.
2. **Auth & Protection**:
   ```ts
   import { requireAdmin } from "@/lib/admin-auth"
   import { db } from "@/lib/db"

   export default async function SubscriptionCenterPage() {
     const admin = await requireAdmin() // Automatically checks DB role & permissions
     
     // Query subscription metrics, active tiers, dunning queue, MRR data
     return <SubscriptionCenterClient admin={admin} ... />
   }
   ```
3. **Layout Inheritence**: Automatically wrapped by `app/(admin)/admin/layout.tsx`!
4. **Sidebar Entry Registration**:
   In `components/admin/AdminLayoutClient.tsx`, add an entry to `NAV_ITEMS`:
   ```ts
   {
     name: "Subscription Center",
     path: "/admin/subscription-center",
     icon: CreditCard,
     resource: "Orders"
   }
   ```
5. **Subadmin Permission Scope**: Policy matchers in `lib/subadmin-permission-policy.ts` already cover `/admin/subscriptions` under the `Orders` resource. Add `/admin/subscription-center` if distinct resource rules are needed.

---

### Route 2: `/dashboard/premium`

1. **Page Creation**: Place file at `app/(dashboard)/dashboard/premium/page.tsx`.
2. **Auth & Protection**:
   ```ts
   import { auth } from "@/lib/auth"
   import { redirect } from "next/navigation"
   import { db } from "@/lib/db"

   export const dynamic = "force-dynamic"

   export default async function PremiumDashboardPage() {
     const session = await auth()
     if (!session?.user?.id) redirect("/login")

     // Fetch user's active premium subscriptions & entitlements
     return <PremiumDashboardClient userId={session.user.id} ... />
   }
   ```
3. **Layout Inheritence**: Automatically wrapped by `app/(dashboard)/dashboard/layout.tsx`!
4. **Sidebar Entry Registration**:
   In `components/dashboard/DashboardLayoutClient.tsx`, add an entry to `NAV`:
   ```ts
   {
     name: "Premium Portal",
     path: "/dashboard/premium",
     icon: "★",
     color: "text-amber-400"
   }
   ```

---

## 6. Summary Matrix: What to Reuse vs What NOT to Do

| Task / Domain | Standard Way (To Reuse) | ❌ What NOT to Do |
|---|---|---|
| Middleware | `proxy.ts` (automatically active) | Do NOT create `src/middleware.ts` or add new middleware files |
| Client Server Auth | `auth()` or `authState()` from `@/lib/auth` | Do NOT call raw Clerk `auth()` without Prisma sync |
| Admin Server Auth | `requireAdmin()` from `@/lib/admin-auth` | Do NOT write custom role checks or trust client headers |
| API Route Auth | `requireApiAuth()` from `@/lib/api-auth` | Do NOT parse authorization headers manually |
| Layout Shell | Place pages inside `app/(admin)/admin/...` or `app/(dashboard)/dashboard/...` | Do NOT re-wrap pages with custom layout divs or headers |
| Sidebar Links | Register in `NAV_ITEMS` (`AdminLayoutClient`) or `NAV` (`DashboardLayoutClient`) | Do NOT hardcode navigation links inside page components |
