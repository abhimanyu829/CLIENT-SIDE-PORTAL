# Phase 0 — Idempotency & Transaction/Consistency Matrix

Combines the transaction-boundary audit and the idempotency audit into one table, since in this codebase they are closely correlated (well-transacted operations also tend to be the well-idempotent ones).

| Operation | Transactional? | Idempotent? | Reason |
|---|---|---|---|
| products.create | Yes | NOT_IDEMPOTENT | New row every call; relies on DB unique constraint on slug to reject exact retries (throws, doesn't dedupe) |
| products.update | Yes | IDEMPOTENT (end-state) | Same payload → same fields, but version/audit/ProductVersion accumulate on every call — not side-effect-free |
| products.updateStatus | Yes | IDEMPOTENT | Re-setting the same status is a safe no-op in effect (still logs duplicate audit rows) |
| products.delete | Yes | PARTIALLY_IDEMPOTENT | Soft-archive path (has orders) is idempotent; hard-delete path throws on retry (`findUniqueOrThrow`) since the row is gone |
| products.updateTier (price) | Yes | IDEMPOTENT (end-state) | Repeat with identical target price is a no-op for PricingHistory; a stale/replayed request with a different price than current WILL re-fire price-change side effects |
| products.stock adjust (increase/decrease/restock) | Yes | **NOT_IDEMPOTENT** | Additive operations — a replayed request doubles the delta |
| products.stock adjust (reset/mark/set-absolute) | Yes | IDEMPOTENT | Absolute-value sets are naturally safe to repeat |
| products.stock.decrement (purchase-driven) | Yes (within itself) | **NOT_IDEMPOTENT — no idempotency key on orderId** | Confirmed real bug: a replayed webhook/retry will double-decrement stock and double-increment soldStock |
| coupons.create | Yes | Guarded (duplicate-code check in-tx) | Effectively idempotent against the specific failure mode of double-creation with the same code |
| coupons.applyToCart | Not transactional (3 separate un-transacted queries: lookup, usage-count, cart update) | IDEMPOTENT for repeat of the exact same request | Race condition possible under concurrent cart mutation from the same user (rare but real) |
| subscriptions.upgrade | Transactional (DB side only — Stripe call happens first, outside any transaction) | **NOT_IDEMPOTENT** | Re-calling re-runs the Stripe update and DB update again; no dedup key. Partial-failure window: Stripe succeeds, DB `changePlan` throws → out-of-sync state with no compensating action |
| subscriptions.downgrade | Not transactional at the route level (only writes AuditLog) | NOT_IDEMPOTENT at the route level | Actual tier change deferred to the Stripe webhook, which IS transactional and safe to re-deliver (idempotent in effect via webhook idempotency) |
| subscriptions.pause / resume | Transactional | State-guarded (409 on invalid transition) — not a true idempotency key, but functionally equivalent for the common case | |
| subscriptions.cancel | Transactional (DB side); Stripe call first, outside transaction | Redundant-safe (Stripe API itself is idempotent for an already-cancelled sub) but re-runs the full local transaction each time (harmless but wasteful) | |
| orders.createFromCart | Transactional | **IDEMPOTENT — genuinely well-designed.** `Order.cartId` unique constraint + explicit P2002-catch-and-refetch pattern. This is the best idempotency implementation found in the codebase and should be used as the template for the Agent Gateway's own idempotency-key design. | |
| payments.webhook (Stripe/Razorpay) | Per-handler transactions, not one outer transaction | IDEMPOTENT via `WebhookEvent.eventId` unique + status gate | Razorpay degrades to a random fallback ID if `x-razorpay-event-id` header is absent — a real, if narrow, idempotency weak point |
| payments.manualVerification.submit | Transactional | IDEMPOTENT | `PaymentVerification.orderId` unique (upsert) + `utrNumber` unique (prevents reuse across orders) |
| payments.manualVerification.approve | **Partially transactional** — the verification-status update is a standalone write, separate from the `markOrderPaid` transaction that follows | Guarded by `verificationStatus !== AWAITING_VERIFICATION` pre-check, but a crash between the two writes leaves `PaymentVerification.APPROVED` with the order not yet marked paid | Real, if narrow, consistency gap |
| refunds.process | Transactional (DB side); gateway call first, outside transaction | Guarded by `payment.status === REFUNDED` pre-check (safe no-op on 2nd app-level call) — but **no idempotency key sent to the gateway itself**, so a network-level retry of the *first* gateway call (before the DB write lands) could double-refund at Stripe/Razorpay | This is the single most important idempotency gap for the Agent Gateway's approval-then-execute flow to close, since REF-02 is explicitly CRITICAL and any AI-adjacent path to it needs airtight replay safety |
| refunds.approve/deny | Transactional | Guarded by `status !== PENDING` pre-check | |
| campaigns.create | Transactional | NOT_IDEMPOTENT | New row each call; also has the CAMPAIGN_STARTED-emitted-for-drafts bug (see BUG-BASELINE) |
| campaigns.toggle (launch/pause) | Transactional | IDEMPOTENT | Well-designed symmetric reversal |
| leads.create | Not transactional (2 separate writes: Lead + optional LeadActivity) | NOT_IDEMPOTENT | Duplicate submits create duplicate leads; minor consistency gap on the un-transacted activity write |
| leads.changeStage | Not transactional (up to 3 separate writes) | IDEMPOTENT (end-state) | |
| deployment.advanceStatus | Transactional (core update); side effects (timeline/email/notify/Pusher) outside, swallowed-error | Self-guarding — throws on already-finalized deployment, so effectively rejects rather than silently repeats | |
| deployment.applyUpgrade | Not transactional (2 sequential updates) | **IDEMPOTENT — explicit `if (upgrade.status === "APPLIED") return` guard.** Good model. | |
| deployment.runLifecycleAction (suspend/resume/etc.) | Not transactional | **NOT_IDEMPOTENT — no guard against re-suspending an already-suspended service** (unlike applyUpgrade's pattern) | |
| admin.banUser / changeRole / gdprDelete | Transactional | IDEMPOTENT (re-applying same state is safe) | |
| subadmin.createAccount | **Not transactional** — 5+ independent writes (user upsert, account upsert, permission upserts, application update, activity log, email) | Upsert-safe on email for the User/Account rows, but a partial failure mid-sequence leaves genuinely inconsistent state with no rollback | |
| subadmin.setPermissions | **Not transactional** (parallel `Promise.all` of independent upserts/revokes) | Diff-based, safe to re-run with the same target permission set | |

## Rollback / Recovery mechanisms actually present (not aspirational)

| Mechanism | Where used | Automatic or manual? |
|---|---|---|
| `ProductVersion` snapshot + `restoreProductVersion` | Products | Manual (admin explicitly restores) |
| `PricingHistory` immutable ledger | ProductTier price changes | Manual (no auto-revert; ledger is audit-only) |
| Symmetric action (opposite call reverses state) | Subscription pause/resume, campaign launch/pause, user ban/unban, refund deny (reverses suspension) | Manual, but well-supported |
| Soft-archive instead of delete | Product delete (only if referenced by orders) | Automatic (the delete action itself chooses this path) |
| `db.$transaction` automatic rollback | Every transactional operation listed above | Automatic, DB-native |
| **None** | Stock decrement, price change (beyond the ledger), campaign creation, lead creation, deployment lifecycle actions (suspend/resume), subadmin account creation | — |

**Implication for Phase 1:** any capability lacking a rollback mechanism here is automatically a poor candidate for `AUTONOMOUS`/`AUTOPILOT` mode regardless of its risk tier — the architecture spec's `supportsRollback` flag on `AgentToolDefinition` should be set to `false` for all "None" rows above, which forces `APPROVAL_REQUIRED` at minimum per the policy function's design intent.
