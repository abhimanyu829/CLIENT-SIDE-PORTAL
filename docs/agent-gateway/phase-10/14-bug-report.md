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

## Pre-existing (not changed by Phase 10)

| Issue | Severity | Owner | Impact | Why not changed |
|---|---|---|---|---|
| Phase 2 lifecycle transitions are read-then-`update` (`suspend`, `reactivate`, `revoke` do not condition the write on the status they read). A `suspend` racing a `revoke` can overwrite `REVOKED` with `SUSPENDED`. Credentials stay revoked (the connection cannot authenticate and cannot be rotated), but "revoke is terminal" is not guaranteed under that race. | P2 | PHASE-2 | narrow race between two administrators | the connection service is a protected Phase 2 system; recommended fix: `updateMany({ where: { id, status: <read status> } })` and `ILLEGAL_STATE_TRANSITION` on count 0 |
| The Phase 1 signed-request canonical message does not include the nonce | P2 | PHASE-1 | replay within the skew window with a fresh nonce | protocol change; documented in Phase 9 |
| The Phase 2 lifecycle routes accept no reason, so the governance confirmation for suspend / revoke / rotate cannot audit one | P3 | PHASE-2 | less audit context | protected route contract |
| `/admin/agent-approvals` pages are not in the sidebar | P3 | PHASE-7 | discoverability | governance links to them from Approvals |
| `lib/queue.ts` lazy no-op, Upstash client from `REDIS_URL`, feedback TS error, 122 lint problems | P3 | INFRASTRUCTURE / APP | see Phases 8–9 | unrelated |

## Known limits (by design)

- Governance UI behaviour (clicks, dialogs, toasts) is verified through server rendering and source checks; there is no browser / DOM test runner in this repository (no jsdom or Testing Library installed). Interactive behaviour relies on the existing `ConfirmDialog`, `Dialog` (Radix) and `useToast` components.
- Lists use offset pagination (existing admin convention). The unfiltered task list sorts by `createdAt` without a dedicated index; task retention (30 days) bounds the table. See `15-database-verification.md`.
