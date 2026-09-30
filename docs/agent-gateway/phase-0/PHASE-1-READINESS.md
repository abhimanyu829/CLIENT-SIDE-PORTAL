# Phase 0 — Phase 1 Readiness Report

## Readiness checklist (per audit Section 36/37)

- [x] Complete relevant architecture audited
- [x] Existing admin architecture mapped
- [x] Existing product architecture mapped
- [x] Existing backend services mapped
- [x] Human admin actions mapped
- [x] Team/sub-admin actions mapped
- [x] Capability matrix completed
- [x] Risk matrix completed
- [x] Authorization matrix completed
- [x] Data sensitivity matrix completed
- [x] Side effects identified
- [x] Rollback identified
- [x] Idempotency identified
- [x] Dangerous primitives identified (none blocking; one adapter-design note)
- [x] Future AI boundary identified (per-domain, in CAPABILITY-MATRIX.md and SERVICE-DEPENDENCY-MAP.md)
- [x] Existing event system mapped
- [x] Existing queue/worker system mapped (**with an open ambiguity — see Blockers**)
- [x] Existing cache/revalidation mapped
- [x] Security baseline completed
- [x] Threat model completed
- [~] Existing-system regression baseline completed (**partial — DB connectivity check inconclusive at time of audit due to environmental connection-pool exhaustion; schema validation succeeded**)
- [x] Bugs documented (18 found, all DOCUMENT_ONLY or FIX_IN_FUTURE_PHASE, zero fixed in this phase)
- [x] Relevant tests run (typecheck, lint — no test suite exists to run)
- [x] Typecheck status recorded (1 pre-existing error, unrelated to Agent Gateway)
- [x] Lint status recorded (122 problems, all cosmetic/config, zero security-relevant)
- [x] Build status — not run (would require a full `next build`; typecheck+lint+schema-validate were treated as sufficient read-only signal; flagged if a full build is desired before Phase 1 sign-off)
- [x] No unrelated code changed (confirmed in final diff review)
- [x] No existing feature deleted
- [x] No protected system modified
- [x] Phase 1 prerequisites documented (below)

## Answers to the 20 Future Agent Gateway Readiness Questions

1. **Safest future entry point?** `lib/services/*.ts` where the real logic lives there (subscription-service, refund-service, invoice-service, service-lifecycle-service), OR the Server Action / Route Handler directly where logic is inlined (most of the Products domain). Never raw Prisma.
2. **Which existing services are safe adapters?** `subscription-service.ts`, `refund-service.ts` (with BUG-13 fixed first), `service-lifecycle-service.ts`, the Products `actions.ts` functions, `enterprise-commerce-service.ts`'s `createOrderFromActiveCart`.
3. **Which existing actions are too UI/session-specific?** None found that are architecturally blocked — Server Actions in this codebase take explicit parameters rather than relying on browser-only state, so they translate to adapter calls reasonably cleanly. The harder cases are routes using `headers()`/`cookies()` internally (e.g. `requireAdmin()`'s reliance on proxy-injected headers) — these need a machine-identity equivalent, not a redesign.
4. **Which capabilities are read-only?** See AI-EXPOSURE-CANDIDATES.md's first section — ~10 identified.
5. **Which are low-risk?** ~15, see same document.
6. **Which are high-risk?** ~20, see same document.
7. **Which are critical?** ~15, permanently excluded from generic tool status.
8. **Which need approval?** All HIGH_RISK_MUTATION entries, by default, per the architecture spec's policy function.
9. **Which can eventually be autonomous?** Only LOW_RISK_WRITE entries with a working, cheap rollback — `products.createDraft` is the strongest candidate.
10. **Which must remain blocked?** All CRITICAL-tier entries (refund execution, payment approval, role changes, subadmin provisioning, credential/config updates) — permanently, not just initially.
11. **What data must never leave the backend?** `ENCRYPTION_KEY`, any `decrypt()` result, `SubadminAccount` credential hashes, raw `.env` values — see DATA-SENSITIVITY-MATRIX.md.
12. **What secrets must never be exposed?** Same as above, plus gateway/payment API keys — confirmed none are currently hardcoded anywhere reachable.
13. **What resource-scope checks are required?** Ownership checks matching the *existing* pattern exactly (`resource.userId === identity.ownerId`), not a new looser check — see AUTHORIZATION-MATRIX.md.
14. **What event mechanisms already exist?** Pusher (`emitEvent`), ISR (`lib/revalidate.ts`), client polling — see EVENT-MAP.md. All three must be triggered by an AI mutation the same way a human mutation triggers them (by calling the same underlying function).
15. **What asynchronous operations already exist?** BullMQ jobs across 3 ambiguous worker entry points — see SERVICE-DEPENDENCY-MAP.md's Blocker below.
16. **Which mutations lack idempotency?** Stock decrement, stock increase/decrease (additive), subscription upgrade (Stripe-then-DB), refund gateway call, campaign/lead/tier creation — full list in IDEMPOTENCY-MATRIX.md.
17. **Which mutations lack rollback?** Stock decrement, price change (ledger-only, no auto-revert), campaign creation, lead creation, deployment lifecycle suspend/resume, subadmin account creation — full list in IDEMPOTENCY-MATRIX.md's rollback table.
18. **Which operations have dangerous side effects?** None rise to "dangerous" in the architecture-spec sense (no SQL/shell/eval) — the closest is `service-discovery`'s unscoped generic update, which is a validation gap, not a dangerous primitive.
19. **Which backend services are suitable for Phase 4 adapters?** Same answer as Q2 — the services that are actually canonical (confirmed via CAPABILITY-MATRIX.md's notes column), explicitly excluding the dead `coupon-service.ts`.
20. **What must Phase 1 build first?** See Prerequisites below.

## Phase 1 Prerequisites (what Phase 1 will need — described, not built, per Section 34)

1. **Resolve the worker-topology ambiguity** (three divergent entry points) operationally before any AI-triggered async job design assumes a specific queue/worker behavior.
2. **Fix BUG-13** (refund gateway idempotency key) before any refund-adjacent capability — even fully human-approved — is wired through the gateway, since REF-02 is explicitly the highest-consequence CRITICAL capability in the matrix.
3. **Design a machine-identity equivalent** for `requireAdmin()`'s DB-role-recheck + subadmin-permission-matrix pattern — Phase 1's `AgentIdentity` must funnel through the same authorization primitives, not a parallel path.
4. **Decide the secret-storage mechanism** for `AgentConnection.credentialRef` — this codebase's `.env`-based config is not itself a secrets manager; Phase 1 needs a real one (Vault, cloud KMS, or equivalent), a decision explicitly out of Phase 0's scope but flagged as blocking.
5. **Pick the adapter target explicitly, per capability**, using CAPABILITY-MATRIX.md's NOTES column to avoid wiring an adapter to dead code (`coupon-service.ts`) or an inconsistent duplicate (`stock` REST route vs. Server Action).
6. **Build nonce/timestamp replay protection fresh** — confirmed no first-party pattern exists to reuse (SECURITY-BASELINE.md).
7. **Build per-connection rate limiting fresh** — confirmed current limiters are user/IP-keyed only, not connection-keyed.

## Blockers (things Phase 0 could not fully resolve within a read-only audit)

- **Worker topology:** cannot determine from the repo alone which of `jobs/worker.ts` / `lib/workers.ts` / `jobs/embedding.job.ts` actually runs in the deployed production environment. This requires an operational check (deployment configuration/dashboard), not a code read.
- **DB connectivity live-check:** inconclusive at time of audit due to connection-pool exhaustion (environmental, not code-related). Schema validation succeeded independently. Recommend re-running a live regression check once the connection pool is not saturated, before Phase 1 begins any implementation that depends on DB availability assumptions.
- **`Coupon.usedCount` end-to-end enforcement (BUG-04):** the order-confirmation increment site (if one exists at all) was not located in this pass — would need a dedicated, deeper trace of `markOrderPaid` and everything it calls, beyond what was needed to answer Phase 0's specific questions.

## Recommended Phase 1 Inputs (summary, cross-referencing all Phase 0 artifacts)
- ARCHITECTURE-AUDIT.md → overall pipeline and topology
- CAPABILITY-MATRIX.md → per-capability adapter target, risk tier, notes
- RISK-MATRIX.md → tier rationale
- AUTHORIZATION-MATRIX.md → identity model requirements
- DATA-SENSITIVITY-MATRIX.md → redaction requirements for tool output schemas
- SERVICE-DEPENDENCY-MAP.md / SIDE-EFFECT-MAP.md → what a Backend Adapter must trigger, and what it must not assume succeeded
- IDEMPOTENCY-MATRIX.md → which capabilities need the gateway's own idempotency layer to compensate for underlying gaps
- EVENT-MAP.md → how AI mutations must reach the same UI-reflection mechanisms as human ones
- SECURITY-BASELINE.md / THREAT-MODEL.md → what to reuse vs. build fresh
- DANGEROUS-PRIMITIVE-AUDIT.md → confirms no forbidden primitives exist to accidentally wrap
- BUG-BASELINE.md → pre-existing issues to fix before (not during) building on top of the affected capabilities
- AI-EXPOSURE-CANDIDATES.md → the flattened candidate list itself
