# 10 — Bug Report (Phase 5)

## Bugs found and fixed

| ID | Sev | Root cause | Fix |
|---|---|---|---|
| BUG-P5-1 | P2 | `EntitlementSourceType.SUBSCRIPTION` undefined — imported from a module that does not re-export it | import from `@prisma/client` (re-export added for the webhook hook) |
| BUG-P5-2 | P2 | Retry of a FAILED_RETRYABLE op re-created the provisioning record → unique conflict | retry reuses the same dedupeKey record (attemptCount++), so no duplicate grants are possible |
| BUG-P5-3 | P2 | Expiry op treated NULL `expiresAt` as expired — permanent grants were terminated | only expire ACTIVE grants with a past `expiresAt` (null = permanent, untouched) |
| BUG-P5-4 | P1 | Expiry op expired grants even when the subscription was still paid through → a stale job could shorten a renewed period | guard: ACTIVE subscription with future period end → expiry is a no-op (deterministic race result; mandatory test) |
| BUG-P5-5 | P1 | Revocation/suspension attempted on EXPIRED/REVOKED grant rows → illegal transition crash | only ACTIVE/PENDING/SUSPENDED rows are revoked/suspended; terminals are skipped |
| BUG-P5-6 | P3 | Renewal `extendEntitlementGrant` threw CONFLICT when new end == current end (equal paid-through) | skip equal/earlier extensions (never shrink), idempotent success |
| BUG-P5-7 | P3 | TRIALING subscription could be provisioned (verified-period gate missing) | grant ops require status ACTIVE |
| BUG-P5-8 | P3 | Test fixtures used fixed 2026 dates vs the real clock (Oct 2026) — wrong relative semantics | relative `Date.now()` fixtures throughout |
| BUG-P5-9 | P3 | `ProvisioningError` used as a type after value-import destructure (TS2749) | narrowed object cast |

## Pre-existing (untouched)

- 3 gateway tsc errors + 40 gateway test failures (HEAD `125d2c5`).
- 6 legacy `Catalog*` tables (drift).
- Razorpay live TEST credentials `401` (Phase-4 blocker, separate).

No P0. No open Phase-5 defect.