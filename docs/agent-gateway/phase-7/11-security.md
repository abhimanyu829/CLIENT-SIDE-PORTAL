# Phase 7 — Security

## Invariants and where they are enforced

| # | Invariant | Enforcement | Test |
|---|---|---|---|
| 1 | Phase 6 DENY can never become execution | evaluator step 2; gate | p7-autonomy (Section I), p7-execution-gate, p7-end-to-end #4 |
| 2 | No autonomy level removes a mandatory approval | evaluator step 9 | p7-autonomy |
| 3 | Default is read-only | evaluator default | p7-autonomy, p7-end-to-end #8 |
| 4 | Approval authorizes one exact operation | binding digest | p7-approval-primitives, p7-execution-gate, p7-end-to-end #6 |
| 5 | Approval is single use | conditional consume | p7-approval-services, p7-execution-gate |
| 6 | Concurrent consumers: exactly one wins | conditional consume | 2/10-way tests |
| 7 | Concurrent requests: one live request | unique `activeBindingKey` | 10-way tests |
| 8 | Approvals expire; boundary counts as expired | `isExpired`, `expiresAt > now` in every write | p7-approval-primitives, services, gate |
| 9 | Policy/authorization change invalidates approvals | versions in binding; sibling cancel | gate, p7-end-to-end #7 |
| 10 | Revocation after approval blocks execution | live Phase 6 + autonomy + identity every call | gate |
| 11 | Rejection is final for that operation | `findRecentRejection` | gate, p7-end-to-end #5 |
| 12 | Terminal states cannot be revived | state machine + conditional updates | primitives, services |
| 13 | Only SUPER_ADMIN decides | `assertApproverScope` | services, admin routes |
| 14 | Approver identity comes from the session only | `requireHumanApprover`, strict schema | services, admin routes |
| 15 | Agent credentials never count as human approval | `carriesAgentCredential` | services (Section F), admin routes |
| 16 | Agent cannot reach approval or autonomy writes | no tool/capability; structural tests | p7-cua-boundary, p7-end-to-end #10 |
| 17 | Cua observation never approves | `cuaObservationCanGrantApproval() === false`; no code path | p7-cua-boundary |
| 18 | Desktop control alone cannot approve | SMS step-up | services |
| 19 | Step-up code never stored or returned in clear | hash only | services |
| 20 | Step-up brute force bounded | 5 attempts, 5 min | services |
| 21 | Human confirms the exact binding | `confirmedBindingDigest` constant-time compare | services |
| 22 | Fail closed on any error | gate outer catch; POLICY_UNAVAILABLE | gate |
| 23 | Errors leak nothing internal | generic messages; route error mapper | gate (Section Q), admin routes |
| 24 | Raw inputs are not persisted | only digest + redacted summary | primitives (redaction) |
| 25 | Secrets redacted in summaries | `redactValue` | primitives |
| 26 | Public references are unguessable | 128-bit random `apr_` ref; ref shape validated | services, admin routes |
| 27 | Viewing an approval never changes it | GET/page are read-only | admin routes |
| 28 | Connection lifecycle retires approvals | suspend/revoke/reactivate routes | services |
| 29 | Backend never invokes Cua | no spawn/pipe/net code | p7-cua-boundary |

## Static review of new code

Searched all Phase 7 files for `eval`, `new Function`, `child_process`, `exec(`, `spawn(`, `$queryRaw`, `$executeRaw`, and logging of tokens/codes. None found. All DB access is through Prisma's typed client.

## Unauthenticated surfaces

None added. Every new route requires a SUPER_ADMIN Clerk session.
