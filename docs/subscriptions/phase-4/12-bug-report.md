# 12 — Bug Report (Phase 4)

## Bugs found and fixed (all test-authoring or expect-vs-code mismatches)

| ID | Sev | Root cause | Fix |
|---|---|---|---|
| BUG-R-1 | P3 | FREE rejection test regex did not match the code's message | aligned expectation with `FREE plans cannot be mapped` |
| BUG-R-2 | P3 | Out-of-order tests seeded two subscriptions with the same `razorpaySubscriptionId`; fake `findUnique` returned the first row, events hit the wrong record | distinct provider ids per fixture; conflict metadata asserted on the targeted row |
| BUG-R-3 | P3 | `createRecurringSubscription` reconciliation error message lacked the word "reconciliation" (test asserted code, not substring) | message now reads "...— reconciliation required" |
| BUG-R-4 | P3 | route spread duplicated `received` key (TS2783) | `{ ...result, received: true }` |
| BUG-R-5 | P3 | fake `seedSubscription` double-wrote `userId` in one literal (TS2783) | destructure + base/rest merge |
| BUG-R-6 | P3 | optional `actorId` passed to required param (TS2345) | audit guarded `if (actorId)` |
| BUG-R-7 | P3 | Prisma `Json` metadata spread from non-object (TS2698) | extracted casted metadata variable |

## Pre-existing issues (out of scope, untouched)

- 3 gateway `tsc` errors + 40 gateway suite failures (HEAD `125d2c5`).
- 6 legacy `Catalog*` tables in the live DB not in schema.prisma (drift).
- Razorpay TEST-MODE live round-trip not executable here (no merchant keys).

No P0. No open Phase-4 defect.