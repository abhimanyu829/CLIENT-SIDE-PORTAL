# Original User Request

## Initial Request — 2026-06-13T07:28:40+05:30

Analyze the current Next.js project codebase to determine which Clerk authentication features are currently implemented, specifically checking for email verification, password change functionality, mobile number verification, SMS, and other related services. Create a detailed report of the findings.

Working directory: c:\Users\Abhimanyu\Desktop\start-client

## Requirements

### R1. Feature Analysis
Scan the codebase for Clerk hooks, components, and API calls to determine if the following features are actively implemented: email verification, password change, mobile number verification, and SMS.

### R2. Read-Only Constraint
Do NOT modify, add, or delete any source code files in the project. This is strictly a read-only analysis.

### R3. Output Format
Generate a comprehensive Markdown artifact detailing which features were found and where they are implemented, as well as which features are missing.

## Acceptance Criteria

### Verification
- [ ] A Markdown artifact named `clerk_features_report.md` is created in the project or artifacts directory.
- [ ] The report explicitly lists the status (Found/Not Found) for: email verification, password change, mobile number verification, and SMS.
- [ ] No project source code files have been modified.

## Follow-up — 2026-07-23T21:23:47+05:30

Build a complete, production-ready Subscription & Billing Center for the existing Next.js application (NexusAI). The goal is to extend the current architecture seamlessly without rewriting, duplicating, or breaking existing logic (Authentication, Marketplace, Product/Service System, existing Payments).

Working directory: c:\Users\Abhimanyu\Desktop\start-client
Integrity mode: benchmark

## Requirements

### R1. Strict Extension & Backward Compatibility
You must inspect and reuse existing components, API routes, middleware, RBAC, and Prisma models. Do NOT recreate authentication or existing dashboard layouts. Extend the existing Prisma schema (adding `SubscriptionPlan`, `PlanBenefit`, `PremiumService`, `ServiceCategory`, `AddonService`, `UserSubscription`, `SubscriptionInvoice`, `SubscriptionPayment`) without modifying unrelated models.

### R2. Admin Subscription & Billing Center
Create a comprehensive Admin module under `/admin/subscription-center` containing 15 sub-modules:
1. Subscription Plans (Pricing in multiple currencies, Billing Cycles, Visibility, Status)
2. Plan Benefits (Dynamic sorting/highlighting for pricing page)
3. Premium Services (Internal/External URLs, Thumbnail, Category)
4. Service Categories
5. Pricing
6. Billing Cycles
7. Add-on Services
8. Upgrade Paths (Starter -> Pro -> Enterprise)
9. Renewal Rules
10. Coupons (Future Ready)
11. Subscribers
12. Invoices
13. Payment Records
14. Analytics
15. Settings

### R3. Premium Services Workspace (User Facing)
Create `/dashboard/premium` that is ONLY accessible to users with an active subscription. The frontend must dynamically build this workspace from the backend (never hardcoded), displaying the user's current plan, expiry, remaining days, and the specific premium services they are assigned. 

### R4. Backend-Enforced Access Control & Pricing
The backend must be the absolute single source of truth. The frontend must never calculate prices or decide permissions. Direct URL access to premium services without an active subscription must return 403 or redirect.

### R5. Payment Integration & Lifecycle
Extend the existing Razorpay integration. The backend must handle price/plan validation, payment verification, subscription activation, and invoice generation. The system must manage the full lifecycle (Pending -> Active -> Renewed -> Suspended -> Expired -> Cancelled -> Archived) via backend logic. The architecture must be modular enough to easily support future gateways (Stripe, Cashfree, etc.) without major redesign.

## Acceptance Criteria & Agent-as-Judge Verification Rubric

### 1. Architectural Integrity
- [ ] **No Duplication:** Existing authentication and dashboard layout wrappers are reused. No duplicate auth middleware is introduced.
- [ ] **Schema Extension:** The Prisma schema successfully applies the new models without breaking existing relations.

### 2. Admin Capabilities
- [ ] **Data Management:** An agent can programmatically create a `SubscriptionPlan`, assign a `ServiceCategory`, link a `PremiumService`, and configure `PlanBenefit`s through the admin APIs.
- [ ] **Upgrade Paths:** Upgrade paths can be successfully defined and persisted in the database.

### 3. User Workspace & Access Control
- [ ] **Enforced 403:** A user without an active subscription attempting to access `/dashboard/premium` receives a 403 or is redirected.
- [ ] **Dynamic Render:** An active subscriber's `/dashboard/premium` accurately renders only the services explicitly linked to their `SubscriptionPlan` in the database.

### 4. Billing & Lifecycle
- [ ] **Backend Pricing:** The checkout API endpoint completely ignores any price sent from the client and strictly looks up the current price from the `SubscriptionPlan` database record.
- [ ] **Razorpay Flow:** Simulating a successful Razorpay payment callback correctly transitions a `UserSubscription` from Pending to Active and generates a `SubscriptionInvoice`.
- [ ] **Lifecycle Transition:** Manually setting a subscription to 'Expired' in the database immediately revokes access to the Premium Services workspace on the next request.
