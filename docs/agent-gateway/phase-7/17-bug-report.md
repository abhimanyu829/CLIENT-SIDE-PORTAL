# Phase 7 — Bug Report

## Found and fixed during Phase 7

| # | Issue | Fix |
|---|---|---|
| 1 | A rejected operation could be re-opened by the agent simply retrying (the gate created a fresh PENDING request) | Gate checks `findRecentRejection` and returns `APPROVAL_REJECTED` |
| 2 | A PENDING request whose policy context changed stayed approvable, though it could never be consumed | Same-input sibling is cancelled (`POLICY_CHANGED`) whether PENDING or APPROVED |
| 3 | Exceptions outside the approval block (context building, Phase 6 `decide()` throwing) escaped as non-denial errors | `authorize()` wraps the whole evaluation; everything non-denial becomes `POLICY_UNAVAILABLE` |
| 4 | `cancelApprovalByHuman` could report success when nothing was cancelled | Reports the real terminal state |
| 5 | Autonomy `resourceScopeReference` was stored but never enforced | Evaluator step 6b enforces `Type:id` / `Type:*`; malformed -> deny |
| 6 | Gate imported constants from the human decision module, blurring the agent/human boundary | Constants moved to `approvals/constants.ts`; structural test forbids agent-reachable imports of decision functions |
| 7 | A dynamic `import("@/lib/db")` inside the gate deadlocked under concurrent calls in tests | Static import |
| 8 | Suspend -> reactivate could carry an approval granted before suspension into the new lifecycle | Reactivate cancels all live approvals first (fail closed); suspend/revoke cancel best-effort |

## Pre-existing (not changed by Phase 7)

- `app/api/feedback/route.ts(128,11)` TS2322 (`"USER"` not a `Role`).
- 122 ESLint problems repo-wide, including a "File appears to be binary" parse error.
- Items listed in the earlier project review (SUBSCRIPTION_ACTIVATED never emitted, split workers, open cron route, local UTR uploads, live secrets in `.env`) remain.

## Behavior change to note

Through the gate, an unavailable Phase 6 policy store is reported as `POLICY_UNAVAILABLE` instead of `AUTHORIZATION_DENIED`. Still a denial.
