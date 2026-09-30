# Phase 0 — Capability Matrix

Every entry below was traced to an actual existing route/action/service function in this codebase — none are invented. Where an operation has known implementation gaps or duplicate implementations, this is noted in NOTES rather than papered over.

Legend — RISK: R=READ, L=LOW_RISK_WRITE, H=HIGH_RISK_MUTATION, C=CRITICAL.
AI EXPOSURE: RC=AI_READ_CANDIDATE, LC=AI_LOW_RISK_CANDIDATE, AC=AI_APPROVAL_REQUIRED_CANDIDATE, AU=AI_AUTONOMOUS_CANDIDATE (future, not now), BL=AI_BLOCKED.

## Products

| Capability ID | Operation | Route/Action | Function | Auth | Risk | Idempotent | Rollback | AI Exposure | Notes |
|---|---|---|---|---|---|---|---|---|---|
| PROD-01 | List/Get products | admin UI read, `app/api/products/**` | Prisma reads | requireAdmin / public | R | Yes | N/A | RC | |
| PROD-02 | Create product | Server Action | `createProduct` — `app/(admin)/admin/products/actions.ts` | requireAdmin | L | No (new row each call) | Delete draft | LC | Transactional; writes ProductVersion+AuditLog; emits PRODUCT_CREATED |
| PROD-03 | Update product | Server Action | `updateProduct` — same file | requireAdmin | L | Yes (end-state) | ProductVersion / restoreProductVersion | LC | |
| PROD-04 | Change status (incl. "publish") | Server Action | `updateProductStatus` — same file | requireAdmin | H | Yes | Re-set previous status | AC | No dedicated "publish" action exists — publish = status→AVAILABLE |
| PROD-05 | Republish | Server Action | `republishProduct` | requireAdmin | H | Self-guarding (throws on repeat) | AuditLog only | AC | Only valid from REPUBLISH_PENDING |
| PROD-06 | Archive/Delete | Server Action | `deleteProduct` | requireAdmin | H | Partial (soft-archive idempotent, hard-delete not) | Soft-archive if orders exist; hard delete is irreversible | AC | Hard-deletes only if zero OrderItems reference it |
| PROD-07 | Duplicate | Server Action | `duplicateProduct` | requireAdmin | L | No | Delete the copy | LC | |
| PROD-08 | Restore version | Server Action | `restoreProductVersion` | requireAdmin | H | Yes (end-state) | N/A (it IS the rollback mechanism) | AC | |
| PROD-09 | Create tier / change price | Server Action | `createTier` / `updateTier` | requireAdmin | H (price change) / L (create) | Yes (end-state) | PricingHistory row (audit only, no auto-revert) | AC | PricingHistory written only when price actually changes |
| PROD-10 | Delete tier | Server Action | `deleteTier` | requireAdmin | H | No | None | AC | **No order/subscription reference guard — orphan risk (see BUG-BASELINE #7)** |
| PROD-11 | Stock adjust (increase/decrease/restock/reset/etc.) | Server Action *or* REST | `updateStock` (actions.ts) *or* `PATCH /api/admin/products/[id]/stock` | requireAdmin | H | Mixed — additive ops (increase/decrease) NOT idempotent, absolute-set ops idempotent | StockHistory audit trail only, no auto-revert | AC | **Two independent implementations, diverging feature sets and revalidation targets (see BUG-BASELINE #8)** |
| PROD-12 | Stock decrement (purchase-driven) | Internal, `POST /api/admin/products/[id]/stock/decrement` | same file | requireAdmin (caller identity unconfirmed) | H | **No — no idempotency key on orderId (see BUG-BASELINE #6)** | None | BL (internal-only, not a candidate tool) | Documented as internal-only; do not expose |

## Subscriptions / Billing / Payments / Orders / Refunds

| Capability ID | Operation | Route/Action | Function | Auth | Risk | Idempotent | Rollback | AI Exposure | Notes |
|---|---|---|---|---|---|---|---|---|---|
| SUB-01 | Get/list subscription | `GET /api/subscriptions/**` | Prisma read | auth() + ownership | R | Yes | N/A | RC | |
| SUB-02 | Upgrade plan | `POST /api/subscriptions/[id]/upgrade` | `changePlan` — subscription-service.ts | auth()+ownership/admin | H | No | Downgrade back | AC | Calls Stripe before DB update — partial-failure risk if changePlan throws after Stripe succeeds |
| SUB-03 | Downgrade plan | `POST /api/subscriptions/[id]/downgrade` | inline in route (does NOT call changePlan) | auth()+ownership/admin | H | No | Re-schedule | AC | Actual tier change deferred to Stripe webhook — two-step, eventually-consistent |
| SUB-04 | Pause/Resume | `POST /api/subscriptions/[id]/pause\|resume` | `pauseSubscription`/`reactivateSubscription` | auth()+ownership/admin | H | State-guarded (409 on invalid transition) | Symmetric (resume reverses pause) | AC | |
| SUB-05 | Cancel | `POST /api/subscriptions/[id]/cancel` | `cancelSubscription` | auth()+strict ownership (no admin bypass in this route) | H | Redundant-safe (Stripe itself idempotent) | `reactivateSubscription` | AC | |
| ORD-01 | Create order from cart | `POST /api/commerce/orders` | `createOrderFromActiveCart` | auth() | H | **Yes — Order.cartId unique constraint is a real idempotency mechanism** | N/A (cart is snapshot) | AC | Well-designed idempotency; a good model for future gateway idempotency keys |
| ORD-02 | Admin mark-paid (manual escape hatch) | `PATCH /api/commerce/orders` | `markOrderPaid` | requireAdmin (SUPER_ADMIN/SUB_ADMIN inline check) | C | Guarded by order status check | None once fulfilled | BL (financial state override, admin-only, no auto-approval path should ever exist) | |
| PAY-01 | Stripe/Razorpay webhook processing | `POST /api/payments/{stripe,razorpay}/webhook` | handler dispatch | signature verification (not user auth) | H | Yes — WebhookEvent.eventId unique + status gate | N/A (external system of record) | BL (never an agent-invoked tool — this is an inbound integration, not an outbound capability) | |
| PAY-02 | Manual payment proof submit | `POST /api/payments/submit-proof` | route inline | auth()+ownership | L | Yes (PaymentVerification.orderId + utrNumber both unique) | Resubmit resets review state | LC | Screenshot written to local disk — breaks under horizontal scaling (BUG-BASELINE #13) |
| PAY-03 | Manual payment approve | `POST /api/admin/payments/verifications/[id]/approve` | route inline → `markOrderPaid`+`fulfillOrder` | requireSuperAdmin (SUB_ADMIN explicitly rejected) | C | Guarded (status must be AWAITING_VERIFICATION) | Reject path reverts order to PENDING | BL (financial approval; human-only by design) | Non-transactional gap between verification-approved write and markOrderPaid (BUG-BASELINE #12) |
| REF-01 | Refund request (buyer) | `POST /api/refunds/request` | route inline → `processRefund` | auth()+ownership | H | `entitlement.refundRequested` flag guards duplicates | Admin deny reverses suspension | AC | Auto-refund attempt is best-effort; falls back to admin queue |
| REF-02 | Refund process (core) | `processRefund` — refund-service.ts | called from multiple sites | adminId param (caller-enforced) | C | Yes — `payment.status===REFUNDED` guard is a real idempotency check at the DB layer | None (refund is terminal) | BL (moves real money; human approval required, never autonomous) | **No idempotency key passed to the gateway itself — a network retry before the DB write could double-refund at Stripe/Razorpay (BUG-BASELINE #14)** |
| REF-03 | Refund approve/deny | `POST /api/admin/refunds/[id]/{approve,deny}` | route inline | inline role check (not requireSuperAdmin — inconsistency) | C | Guarded (status must be PENDING) | Deny fully reverses suspension | BL | |

## Marketing / CRM / Coupons

| Capability ID | Operation | Route/Action | Function | Auth | Risk | Idempotent | Rollback | AI Exposure | Notes |
|---|---|---|---|---|---|---|---|---|---|
| CPN-01 | Create coupon | Server Action | `createCoupon` — coupons/actions.ts | requireAdmin | L | Guarded (duplicate code check in-tx) | Delete | LC | |
| CPN-02 | Update coupon | Server Action | `updateCoupon` | requireAdmin | L | Yes (end-state) | Re-update | LC | |
| CPN-03 | Deactivate coupon | Server Action | `deactivateCouponAction` | requireAdmin | L | Yes | `updateCoupon(isActive:true)` (no dedicated reactivate action) | LC | |
| CPN-04 | Bulk generate | Server Action | `bulkGenerateCoupons` | requireAdmin | L | No | Delete each | LC | Capped at 500/call |
| CPN-05 | Delete coupon | Server Action | `deleteCoupon` | requireAdmin | H | No | **None — irreversible hard delete** | AC | |
| CPN-06 | Apply coupon to cart | `PATCH /api/cart` | `applyCouponToActiveCart`→`recalculateCart` | requireApiAuth | L | Yes (re-apply same code is safe) | Remove-coupon action (same endpoint) | LC | **Does not increment Coupon.usedCount — usage-quota enforcement gap; see BUG-BASELINE #3** |
| CMP-01 | Create campaign | Server Action | `createCampaign` | requireAdmin | L | No | Delete/pause | LC | **Emits CAMPAIGN_STARTED unconditionally even for DRAFT campaigns — bug, see BUG-BASELINE #4** |
| CMP-02 | Launch/Pause campaign | Server Action | `toggleCampaign` | requireAdmin | H | Yes | Symmetric (opposite call) | AC | This IS the correct symmetric reversal — good model |
| CMP-03 | Duplicate/Delete campaign | Server Action | `duplicateCampaign` / `deleteCampaign` | requireAdmin | L / H | No / No | N/A / unlinks coupons first (no cascade-orphan) | LC / AC | |
| CMP-04 | Automatic campaign activation (cron) | BullMQ, not human/AI-triggered | `campaignWorker` — jobs/campaign.job.ts | N/A (system) | — | Naturally idempotent (status-filtered query) | N/A | N/A (not a candidate — this is a system process) | |
| LEAD-01 | Create lead | `POST /api/leads` | route inline | auth() OR unauthenticated if source="demo" | L | No | Delete | LC | Public demo-capture bypass is intentional |
| LEAD-02 | Change lead stage | `PATCH /api/leads` | route inline | SUPER_ADMIN/SUB_ADMIN only | L | Yes (end-state) | Re-PATCH previous stage (no dedicated revert) | LC | **CRM drag-and-drop UI is NOT wired to this route — stage changes via drag don't persist (BUG-BASELINE #5)** |
| LEAD-03 | Email sequences | UI tab exists | **NOT FOUND — no create/trigger code exists anywhere** | — | — | — | — | BL (does not exist) | Confirmed unimplemented feature; do not plan around it existing |

## Deployment Center / Service Lifecycle

| Capability ID | Operation | Route | Function | Auth | Risk | Idempotent | Rollback | AI Exposure | Notes |
|---|---|---|---|---|---|---|---|---|---|
| DEP-01 | List/get purchased services | `GET /api/admin/deployment-center` | Prisma read | requireAdmin | R | Yes | N/A | RC | |
| DEP-02 | Advance deployment status | `PATCH /api/admin/deployment-center/[id]/status` | `advanceDeploymentStatus` | requireAdmin | H | No (state-machine forward-only, throws on finalized) | None (state machine, no reverse transition) | AC | Transactional |
| DEP-03 | Complete deployment | same route | `completeDeployment` → `updateServiceConfig`+`advanceDeploymentStatus` | requireAdmin | H | No | None | AC | Two separate transactions, not atomic together |
| DEP-04 | Update service config (credentials) | `PUT /api/admin/deployment-center/[id]/config` | `updateServiceConfig` | requireAdmin | C (contains credentials) | Yes | None (overwrite) | BL (credential data — CONFIDENTIAL, see DATA-SENSITIVITY-MATRIX) | Sensitive keys AES-256-GCM encrypted at rest |
| DEP-05 | Apply upgrade | `POST /api/admin/deployment-center/upgrades/[id]/apply` | `applyUpgrade` | requireAdmin | H | Yes — explicit `if applied return` guard | None | AC | Well-guarded — good idempotency model |
| DEP-06 | Suspend/Resume/other lifecycle actions | `POST /api/admin/deployment-center/[id]/action` | `runLifecycleAction` | requireAdmin | H | **No — no guard against re-suspending an already-suspended service** | Symmetric action exists (resume) but not enforced/guarded | AC | |
| DEP-07 | Service Engagement (escrow) proposal/accept/fund/release | — | **NOT FOUND — schema+migration exist, zero business logic implements this** | — | — | — | — | BL (does not exist) | Confirmed unused scaffolding; do not plan around it |

## Support / Analytics / User Management

| Capability ID | Operation | Route | Function | Auth | Risk | Idempotent | Rollback | AI Exposure | Notes |
|---|---|---|---|---|---|---|---|---|---|
| TIX-01 | Create ticket | `POST /api/tickets` | route inline | auth() (any authenticated user) | L | No | Close ticket | LC | |
| TIX-02 | Reply to ticket (client) | `POST /api/tickets/[id]/messages` | route inline | auth()+ownership | L | No | N/A | LC | **Admin cannot reply via this route — stale role-string bug (BUG-BASELINE #2). No working admin-reply path found.** |
| TIX-03 | Close/resolve ticket | `PATCH /api/tickets/[id]` | route inline | auth() + stale "ADMIN"/"STAFF" role check (dead) + ownership fallback | L | Yes | Re-open (no dedicated action, just PATCH again) | LC | **Admin branch uses role strings not in current enum — dead code (BUG-BASELINE #2)** |
| ANL-01 | Revenue dashboard | `GET /api/admin/revenue` | route inline | **inline session.role check, NOT requireAdmin() (BUG-BASELINE #10)** | R | Yes | N/A | RC | Read-only; inconsistency is an auth-hygiene issue, not a data-exposure one given the check itself is still admin-only |
| ANL-02 | AI monitoring dashboard | `GET /api/admin/ai-monitoring/usage` | `getAIMonitoringStats` | requireAdmin | R | Yes | N/A | RC | Correctly uses zero-trust helper |
| USR-01 | Ban/Unban user | `POST /api/admin/users/[id]/ban` | route inline | requireAdmin | H | Yes (re-ban is a safe no-op) | Unban (symmetric) | AC | Fully transactional incl. session invalidation + audit |
| USR-02 | Change role | `PATCH /api/admin/users/[id]` (`case "change-role"`) | route inline | requireAdmin + isSuperAdmin gate | C | Yes | Re-PATCH previous role | BL (privilege change — always human-approved) | Promoting to SUB_ADMIN does NOT create a SubadminAccount — a second, separate admin action is needed or the user cannot pass `validateSubadminCredentialSession` |
| USR-03 | GDPR delete / impersonate | same route, other `case` branches | route inline | requireAdmin + isSuperAdmin | C | N/A | None (GDPR delete is anonymization, irreversible by design) | BL | |
| SADM-01 | Create subadmin account | `POST /api/admin/subadmins/accounts` | `createSubadminAccount` | requireSuperAdmin | C | Upsert-safe on email | None beyond re-provisioning | BL (identity/privilege provisioning — always human) | **No transaction wraps the multi-step write (user+account+permissions+email) — partial-failure risk** |
| SADM-02 | Grant/revoke permissions | `PATCH /api/admin/subadmins/accounts/[id]` | `setSubadminPermissions` | requireSuperAdmin | C | Diff-based, safe to repeat | Re-grant | BL | Not transactional (parallel Promise.all upserts) |
| SADM-03 | Suspend/disable/revoke subadmin | same route / `DELETE` | `updateSubadminStatus` | requireSuperAdmin | C | Yes | Re-activate | BL | |

## Summary counts

- READ candidates (safe to expose first): ~10
- LOW_RISK_WRITE candidates: ~15
- HIGH_RISK_MUTATION (approval-required candidates): ~20
- CRITICAL (blocked from any agent exposure): ~15
- Confirmed non-existent / unimplemented (do not build tools for): Email sequences (LEAD-03), Service Engagement escrow (DEP-07)
