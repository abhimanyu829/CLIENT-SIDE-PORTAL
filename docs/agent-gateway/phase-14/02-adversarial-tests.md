# Phase 14 — 02 Adversarial tests

Single-purpose probes (`ADVERSARIAL_SCENARIOS`, `p14-adversarial` B), each on a fresh gateway in `SIM_WORLD`, each checked against its expectations and all nine invariants.

| Id | Probe | Expected and observed |
|---|---|---|
| ADV-1 | read another tenant's ticket, subscription, product analytics by id | `RESOURCE_NOT_FOUND`, indistinguishable from missing |
| ADV-2 | identity / ownership / role fields in arguments (`ownerId`, `userId`, `vendorId`, `clientId`, `connectionId`) | refused before the gate |
| ADV-3 | close another tenant's ticket (autonomous and ASSISTED connections) | `RESOURCE_NOT_FOUND` / approval request only; nothing changes (finding P14-F2) |
| ADV-4 | reach `refunds.process`, `products.updatePricing`, `coupons.create`, `products.createDraft` by tool name, task submission, path or case variants | not listed, refused; no gate decision, approval or task |
| ADV-5 | bidirectional, NUL and tag characters; over-long ids; over-limit lists | refused before the gate; no approval, no execution event |
| ADV-6 | `trigger.` / `recovery.` idempotency keys (sync and task); keyed write without key | `INVALID_INPUT` / `IDEMPOTENCY_KEY_REQUIRED` |
| ADV-7 | read / cancel another connection's task | `TASK_NOT_FOUND`; the owner still reads it |
| ADV-8 | credential-shaped identifiers | not echoed (I2) |
| ADV-9 | unpublished product through the catalogue | `RESOURCE_NOT_FOUND` for every tenant |

Extra effect checks: ADV-3 leaves both tickets OPEN and no write effect; ADV-4 creates no ledger event for any forbidden capability and no approval or task; ADV-5 creates no approval and no execution event.

Result: 9 / 9 pass. The fuzzer (`04-fuzzing`) found one issue the catalogue did not: P14-F1.
