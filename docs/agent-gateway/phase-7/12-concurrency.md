# Phase 7 — Concurrency

Every race is closed by the database, not by application locks.

| Race | Mechanism |
|---|---|
| N identical first calls | unique `activeBindingKey`; losers catch P2002 and return the winner |
| N retries after one approval | `updateMany WHERE id AND status=APPROVED AND bindingDigest AND expiresAt>now` — `count === 1` only for one caller |
| Two humans deciding at once | decision transaction's conditional update; loser sees `APPROVAL_ALREADY_DECIDED`; unique `approvalRequestId` on the decision row as a second guard |
| Approve vs step-up re-issue | approval `WHERE` includes the exact code hash just verified |
| Approve vs cancel/expire | both are conditional on status PENDING |
| Consume vs cancel | both conditional; whichever commits first wins, the other gets a precise code |
| Policy change vs in-flight retry | the policy version is in the digest; a retry computed under the new version cannot match the old approval |

Tested with 2- and 10-way `Promise.all` against the fake DB, which reproduces unique constraints and single-step conditional updates (`p7-approval-services.test.ts`, `p7-execution-gate.test.ts`). The fake is not Postgres; see `16-test-report.md`.
