# Phase 0 — Authorization Matrix

## Identity layers (current, human-facing)

1. **Clerk** (`@clerk/nextjs`) — primary identity for every user. `lib/auth.ts`'s `authState()`/`auth()` resolve a Clerk session, sync to the local `User` table (`syncClerkUserToDatabase`), and return role/ban status **re-fetched from the DB**, never trusted from the JWT.
2. **Subadmin credential session** (`lib/subadmin-workforce.ts`) — a second, independent username/password login required for any `SUB_ADMIN`-role user before they can use `/admin/*`. Distinct cookie, distinct hashed session token, versioned via `forceLogoutVersion` for instant revocation on suspension/permission change.
3. **Legacy `Permission`/`UserPermission`** — a fallback grant table still consulted by `requireServicePermission()` for a small number of "service center" pages, coexisting with (not replaced by) the newer matrix.

## Role enum (source of truth)

`SUPER_ADMIN | SUB_ADMIN | VENDOR | CLIENT | GUEST` (`prisma/schema.prisma` `Role` enum).

**Confirmed dead code:** `app/api/tickets/[id]/route.ts`, `app/api/tickets/[id]/messages/route.ts`, `app/api/projects/[id]/route.ts` check role strings `"ADMIN"`/`"STAFF"`, which do not exist in this enum. Any admin-bypass logic gated on those checks never executes. See BUG-BASELINE.md #2.

## Auth helper functions (exact call chains)

| Function | File | Chain | Used for |
|---|---|---|---|
| `auth()` | lib/auth.ts | Clerk → DB user upsert | Basic "is logged in", session object with role |
| `requireRole(roles[])` | lib/auth.ts | `auth()` → DB re-fetch role/ban → throw if not in `roles` | Thrown-error style guard for API routes/actions needing a specific role |
| `requireApiAuth()` | lib/api-auth.ts | `auth()` → throw `UnauthorizedError` if no session | Route handlers needing only "is logged in" |
| `requireAdmin()` | lib/admin-auth.ts | `auth()` → DB role/ban re-check → `validateSubadminCredentialSession()` → (SUB_ADMIN only) `canUseSubadminPermission()` against proxy-injected headers | The standard admin gate — SUPER_ADMIN or permission-scoped SUB_ADMIN |
| `requireSuperAdmin()` | lib/admin-auth.ts | `auth()` → DB role re-check, `role === "SUPER_ADMIN"` exact match | Strictly SUPER_ADMIN-only operations (subadmin provisioning, manual payment approval, GDPR delete) |
| `requireServicePermission(name)` / `requireServiceCenterAccess()` / `requireServiceOperationsAccess()` | lib/admin-auth.ts | `requireAdmin()` → subadmin-matrix shortcut OR legacy `Permission`/`UserPermission` lookup | A handful of "service center" pages/routes |

## Subadmin permission matrix (resource × action)

**Resources (14):** Products, Services, Users, Orders, Payments, Refunds, Analytics, Email Center, Support, Media, Blogs, Marketing, CRM, Documentation.
**Actions (6):** VIEW, CREATE, EDIT, DELETE, APPROVE, PUBLISH.

`canUseSubadminPermission(permissions, resource, action)` is a simple `.some()` exact-match against granted `{resource, action}` pairs stored in `SubadminPermission`. `resourceForAdminPath()`/`resourceForAdminApiPath()` map a URL prefix to a resource; `actionForAdminRequest()` derives the action from HTTP method or path keywords (`/approve|/verify|/fulfill`→APPROVE, `/publish|/send|/deliver`→PUBLISH, Server Actions→always EDIT). This mapping is computed once in `proxy.ts` and passed downstream via headers — it is **not** re-derived inside `requireAdmin()`, meaning a call path that bypasses `proxy.ts` (e.g. a direct server-side invocation) skips this specific check, though role/ban/credential-session checks still apply.

## Admin vs. Team Member vs. Future Agent (illustrative, using existing enforcement only)

| Capability | SUPER_ADMIN | SUB_ADMIN (with grant) | SUB_ADMIN (no grant) | CLIENT (owner) | Future Agent (candidate) |
|---|---|---|---|---|---|
| Read own subscription | YES | YES | YES | YES (own only) | AI_READ_CANDIDATE |
| Read any subscription | YES | YES (Orders:VIEW) | NO | NO | AI_READ_CANDIDATE (scoped) |
| Create product draft | YES | YES (Products:CREATE) | NO | N/A | AI_LOW_RISK_CANDIDATE |
| Change price | YES | YES (Products:EDIT) | NO | N/A | AI_APPROVAL_REQUIRED_CANDIDATE |
| Publish product | YES | YES (Products:PUBLISH) | NO | N/A | AI_APPROVAL_REQUIRED_CANDIDATE |
| Delete product | YES | YES (Products:DELETE) | NO | N/A | AI_APPROVAL_REQUIRED_CANDIDATE |
| Process refund | YES | **NO — refund approve/deny use an inline role check that does NOT distinguish granular Refunds permission from bare role**, so any SUB_ADMIN passes the current check regardless of the matrix (see BUG-BASELINE #10-adjacent finding) | — | Request-only, cannot approve own | AI_BLOCKED |
| Manual payment approve | YES (via `requireSuperAdmin`) | NO (explicitly rejected) | NO | NO | AI_BLOCKED |
| Change user role | YES | NO (`isSuperAdmin` gate) | NO | NO | AI_BLOCKED |
| Create subadmin account | YES | NO | NO | NO | AI_BLOCKED |
| Update service credentials/config | YES | YES (Services:EDIT) | NO | NO | AI_BLOCKED (data sensitivity, not just role) |

**Note on the Refunds row:** `app/api/admin/refunds/[refundId]/approve/route.ts` and `.../deny/route.ts` check inline `session.user.role` against `["SUPER_ADMIN","SUB_ADMIN"]` directly rather than calling `canUseSubadminPermission(..., "Refunds", "APPROVE")`. This means the fine-grained matrix (which does define a `Refunds` resource and `APPROVE` action) is not actually enforced for this specific operation — any SUB_ADMIN can approve/deny refunds today regardless of whether they've been granted `Refunds:APPROVE`. This is a real authorization gap worth fixing before this capability is ever exposed to any actor (human delegation or AI), independent of the Agent Gateway work.

## Resource ownership patterns (confirmed via code, not inferred)

- **Ticket/Project ownership:** `ticket.clientId === session.user.id` / `project.clientId === session.user.id`, admin-bypass is dead code (see above).
- **Subscription/Entitlement ownership:** `subscription.userId === session.user.id` / `entitlement.userId === userId`, generally with a working admin bypass (`role === SUPER_ADMIN || SUB_ADMIN`).
- **Refund request ownership:** strict, no admin bypass — `entitlement.userId === userId` (a human cannot request a refund on someone else's behalf, including via the admin panel; refunds are always customer-initiated or admin-approved, never admin-initiated-and-approved in one step).
- **Team/TeamMember model:** confirmed **unrelated** to admin authorization — a separate, user-facing multi-tenant collaboration feature with its own `getTeamMembership()` check. Not used anywhere under `app/(admin)`.

## Implication for Phase 1 identity design

Every future `AgentIdentity` must carry an `ownerId` (mapping to the existing `User.id`) and, where relevant, resolve through the **same** ownership/role checks already enforced by `requireAdmin()`/`requireRole()` — not a parallel check invented for the gateway. Concretely: the Backend Adapter layer should call the *same* `requireAdmin()`/`requireApiAuth()`-protected service functions with a synthesized session context, not bypass them with a new machine-identity-only code path. Where a machine identity has no natural Clerk session to synthesize (the common case), Phase 1 must design a machine-session equivalent that still funnels through the same DB-backed role/permission re-check — this is a real design decision Phase 0 flags but explicitly does not resolve (per instruction not to implement Phase 1).
