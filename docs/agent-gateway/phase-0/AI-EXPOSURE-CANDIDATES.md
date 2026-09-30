# Phase 0 — AI Exposure Candidate Matrix

Technical suitability only — no final permission decisions are made here (per instruction, that's a Phase 3 activity). This is a flattened, quick-reference view of the classifications already justified in CAPABILITY-MATRIX.md and RISK-MATRIX.md.

## AI_READ_CANDIDATE (safe to expose first, once resource-scoped)
products.list/get, subscriptions.get (self/admin-scoped), analytics.revenue (admin), analytics.aiMonitoring (admin), tickets.list/get (ownership-scoped), users.list/get (admin, redacted), coupons.list/get, campaigns.list/get, deployment-center.list/get.

**Caveat:** READ risk tier does not mean unrestricted — see DATA-SENSITIVITY-MATRIX.md. Analytics/revenue reads expose aggregate financial data; user reads must never return unredacted PII in bulk.

## AI_LOW_RISK_CANDIDATE (reversible, low blast radius — good Phase 1 pilot capabilities)
products.createDraft, products.duplicate, products.updateDraftMetadata, coupons.create, coupons.update, coupons.deactivate, coupons.bulkGenerate, campaigns.createDraft, tickets.create, leads.create, leads.changeStage, payments.submitProof (buyer-initiated, not admin).

**Recommendation:** these are the strongest candidates for the very first end-to-end Agent Gateway pilot (Phase 1-2), specifically `products.createDraft` — it is transactional, has a clean rollback (delete the draft), and its existing implementation (`createProduct` in actions.ts) requires no adapter beyond a thin wrapper.

## AI_APPROVAL_REQUIRED_CANDIDATE (HIGH_RISK_MUTATION — human sign-off required, never autopilot)
products.publish/updateStatus, products.changePrice, products.adjustStock (once BUG-08/BUG-09 addressed), products.deleteTier (once BUG-07 addressed), products.delete, subscriptions.upgrade/downgrade/pause/resume/cancel, orders.createFromCart (admin-triggered mark-paid variant only), campaigns.launchPause, deployment.advanceStatus/completeDeployment/applyUpgrade/lifecycleAction, users.banUnban, refunds.request (buyer-initiated only — the request itself, not the approval).

## AI_BLOCKED (permanent — not a phase-in-time restriction, an architectural exclusion)
refunds.process (gateway money movement, no gateway-side idempotency key — BUG-13), payments.manualVerificationApprove (human-judgment task), orders.markPaid (financial system-of-record override), refunds.approveDeny (financial + currently-broken permission enforcement — BUG-10), deployment.updateServiceConfig (handles plaintext credentials pre-encryption), users.changeRole/gdprDelete/impersonate (privilege escalation / irreversible destruction), subadmin.createAccount/setPermissions/updateStatus (privilege provisioning), products.stockDecrement (internal-only, not a human-facing capability either), any capability touching payment-provider/auth configuration, secrets, or infrastructure (none currently exist as in-app capabilities — flagged to ensure none are added as generic tools later).

## Confirmed non-existent (do not plan Phase 1+ tools around these)
- `serviceEngagement`/`serviceMilestone` (escrow proposal/accept/fund/release) — schema and migration exist, zero business logic implements any of it.
- `EmailSequence` create/trigger — schema and UI tab exist, zero implementation.

## One-line rationale summary (why these tiers, not others)
The dividing line between LOW_RISK and APPROVAL_REQUIRED in this codebase tracks almost exactly with whether a rollback mechanism actually exists (see IDEMPOTENCY-MATRIX.md's rollback table) — every AI_LOW_RISK_CANDIDATE above has a working, cheap reversal (delete draft, deactivate, re-PATCH). Every AI_APPROVAL_REQUIRED_CANDIDATE either has no rollback or an expensive/manual one. AI_BLOCKED items either move real external money, handle credentials/secrets in plaintext, or grant privilege — categories the architecture spec explicitly excludes from ever becoming generic tools regardless of any policy configuration.
