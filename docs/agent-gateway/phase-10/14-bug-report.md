# Phase 10 — Bug Report

Severity: P0 exploitable / data loss · P1 security or correctness defect · P2 defect with a workaround or narrow window · P3 minor / cosmetic / test-only.

## Found and fixed

| # | Severity | Owner | Issue | Found by | Fix |
|---|---|---|---|---|---|
| 1 | P2 | PHASE-6 (store) / PHASE-10 | Policy versions had no optimistic concurrency: an administrator publishing from a stale view silently replaced a colleague's newer version. | governance design review | Optional `expectedCurrentVersion` in `createPolicyVersion` / `rollbackToVersion`, checked inside the transaction before any write; unique `(policyId, version)` loss mapped to `PolicyConflictError` → 409. |
| 2 | P2 | PHASE-7 (store) / PHASE-10 | Same for autonomy policies (`setAutonomyPolicy` always wrote N+1; `disableAutonomyPolicy` disabled whatever was active). | governance design review | Optional `expectedVersion` on both, plus the optional field on the existing route; older callers unchanged. |
| 3 | P3 | PHASE-10 | Trigger conflicts surfaced as `TRIGGER_CONFLICT` while every other governance conflict is `CONFLICT`, so the UI showed "not allowed in this state" instead of "changed by someone else". | review of the client error mapping | Governance responses normalize the optimistic-concurrency code to `CONFLICT`. |
| 4 | P3 | INFRASTRUCTURE (test harness) | The Phase 7 fake modelled `agentConnection` as a lookup map only (no create / update / list), had no `agentCredential` / `auditLog` tables, no `skip`, no `include` for credential → connection; the Phase 6 fake had no policy lists, no `count`, no `(policyId, version)` uniqueness. | writing the suite | Fakes extended with Prisma semantics (unique violations as `P2002`, transactional rollback across the merged tables). Every earlier suite re-run green (983/983). |

Test-expectation corrections (product behaviour right, first draft of the test wrong): a policy name below the 2-character minimum in a rollback test; the cold first `beforeEach` of the page-rendering suite exceeding the default 10 s hook timeout (suites now set 60 s).

No P0/P1 defects were found.

## Fixed after Phase 10 (the two pre-existing P2 issues)

| # | Severity | Owner | Issue | Fix | Tests |
|---|---|---|---|---|---|
| F1 | P2 | PHASE-2 | Lifecycle transitions were read-then-`update` (`suspend`, `reactivate`, `revoke` did not condition the write on the status they read). A `suspend` racing a `revoke` could overwrite `REVOKED` with `SUSPENDED` (a `reactivate` could even write `ACTIVE`). Credentials stayed revoked, so the agent still could not authenticate, but "revoke is terminal" did not hold under that race. | Every transition is compare-and-set: `updateMany({ where: { id, status: <read status> } })`; on count 0 the service re-reads and re-judges (already in target → idempotent no-op; otherwise the state machine → `409 ILLEGAL_STATE_TRANSITION`), at most 3 attempts. Revoke's CAS and its credential sweep share one transaction. Audit events record the real previous status, once. | `connection-lifecycle-race.test.ts` (9 tests, deterministic interleavings; 7 fail against the old code) |
| F2 | P2 | PHASE-1 | The signed-request canonical message did not include the nonce: a captured request could be replayed within the 300 s skew window with a fresh nonce. | Canonical message v2: `abhibhi.request.v2`, timestamp, nonce, METHOD, path, sha256(body). No v1 fallback (no downgrade). **Breaking for SIGNED_REQUEST clients**: they must sign v2. Signing is opt-in (`AGENT_GATEWAY_SIGNING_ENABLED`, default off). The nonce is still consumed only after the signature passes. | `signature-verifier.test.ts` (nonce swap, legacy v1, every signed part), `signed-request-nonce.test.ts` (end to end with Redis semantics and a Phase 2 database credential) |

Same root cause as F1, fixed with it:

- The opportunistic expiry in `evaluateCredentialForAuth` wrote `EXPIRED` unconditionally, so an authentication that read `ACTIVE` before a concurrent revoke could turn `REVOKED` into `EXPIRED` (connection and credential). Both writes are now conditional on `ACTIVE`.
- Rotation's in-transaction re-read took no lock, so under Postgres READ COMMITTED a revoke committing mid-rotation could still leave a new `ACTIVE` credential under a `REVOKED` connection (the serialized test fake hid this). The rotation transaction now starts with a conditional write on the connection row (`status: "ACTIVE"`), which takes its row lock: revoke either wins outright or waits and then revokes the new credential.
- Two concurrent rotations could both replace the same credential and leave two `ACTIVE` credentials. The credential being replaced is now read under that row lock, so exactly one stays `ACTIVE`.

No schema change. Existing rows are not rewritten; the fixes prevent new occurrences.

## Pre-existing (not changed by Phase 10)

| Issue | Severity | Owner | Impact | Why not changed |
|---|---|---|---|---|
| Phase 2 lifecycle read-then-`update` race | P2 | PHASE-2 | — | **FIXED after Phase 10** (F1 above) |
| The Phase 1 signed-request canonical message does not include the nonce | P2 | PHASE-1 | — | **FIXED after Phase 10** (F2 above) |
| The Phase 2 lifecycle routes accept no reason, so the governance confirmation for suspend / revoke / rotate cannot audit one | P3 | PHASE-2 | less audit context | protected route contract |
| `/admin/agent-approvals` pages are not in the sidebar | P3 | PHASE-7 | discoverability | governance links to them from Approvals |
| `lib/queue.ts` lazy no-op, Upstash client from `REDIS_URL`, feedback TS error, 122 lint problems | P3 | INFRASTRUCTURE / APP | see Phases 8–9 | unrelated |

## Known limits (by design)

- Governance UI behaviour (clicks, dialogs, toasts) is verified through server rendering and source checks; there is no browser / DOM test runner in this repository (no jsdom or Testing Library installed). Interactive behaviour relies on the existing `ConfirmDialog`, `Dialog` (Radix) and `useToast` components.
- Lists use offset pagination (existing admin convention). The unfiltered task list sorts by `createdAt` without a dedicated index; task retention (30 days) bounds the table. See `15-database-verification.md`.
