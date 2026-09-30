# Phase 3 — Capability Exposure Matrix

The complete initial manifest (`lib/agent-gateway/capabilities/manifest.ts`, `CORE_CAPABILITY_MANIFEST`). Every entry traces to a real, already-documented Phase 0 finding — none are invented.

| ID | Version | Risk tier | Exposure | executionReference | Permission | Rollback |
|---|---|---|---|---|---|---|
| `products.list` | v1 | READ | AGENT_AVAILABLE | `products.listAdapter` | `read:products` | N/A (read-only) |
| `products.get` | v1 | READ | AGENT_AVAILABLE | `products.getAdapter` | `read:products` | N/A (read-only) |
| `subscriptions.get` | v1 | READ | AGENT_AVAILABLE | `subscriptions.getAdapter` | `read:billing` | N/A (read-only) |
| `tickets.list` | v1 | READ | AGENT_AVAILABLE | `tickets.listAdapter` | `read:tickets` | N/A (read-only) |
| `products.createDraft` | v1 | LOW_RISK_WRITE | AGENT_AVAILABLE | `products.createDraftAdapter` | `write:products` | Delete the draft |
| `coupons.create` | v1 | LOW_RISK_WRITE | AGENT_AVAILABLE | `coupons.createAdapter` | *(none — documented gap)* | Delete the coupon |
| `products.updatePricing` | v1 | HIGH_RISK_MUTATION | **INTERNAL_ONLY** | `null` | `write:products` | Admin manually re-sets previous price |
| `refunds.process` | v1 | CRITICAL | **FORBIDDEN** | `null` | *(none — human-only by design)* | None — irreversible |

## Why each exposure level was chosen

- **READ tier -> `AGENT_AVAILABLE`**: Phase 0's `AI-EXPOSURE-CANDIDATES.md` lists these as `AI_READ_CANDIDATE` ("safe to expose first, once resource-scoped"). No state mutation risk.
- **`products.createDraft`/`coupons.create` -> `AGENT_AVAILABLE`**: Phase 0 explicitly names `products.createDraft` as "the strongest candidate for the very first end-to-end Agent Gateway pilot" — reversible, clean rollback, transactional.
- **`products.updatePricing` -> `INTERNAL_ONLY`, not `AGENT_AVAILABLE`**: Phase 0 classifies price changes as `HIGH_RISK_MUTATION` / `AI_APPROVAL_REQUIRED_CANDIDATE` — direct financial impact, no autonomous execution should ever be possible without a policy+approval story that does not exist yet (Phase 6/7). Marking it `AGENT_AVAILABLE` today would be premature even though its schema contract is fully described.
- **`refunds.process` -> `FORBIDDEN`**: Phase 0's `AI-EXPOSURE-CANDIDATES.md` explicitly lists `refunds.process` under `AI_BLOCKED` as "a permanent architectural exclusion, not a phase-in-time restriction" — real money movement with no gateway-side idempotency key (`BUG-BASELINE #14`). Registered here specifically to prove the registry can represent and actively reject a CRITICAL capability, never to make it callable.

## Capabilities explicitly NOT registered (and why)

Per Phase 0's `AI-EXPOSURE-CANDIDATES.md`'s `AI_BLOCKED` list and "confirmed non-existent" section, the following were deliberately excluded from the initial manifest (not merely deferred without reason):

- `payments.manualVerificationApprove`, `orders.markPaid`, `refunds.approveDeny`, `deployment.updateServiceConfig`, `users.changeRole`/`gdprDelete`/`impersonate`, `subadmin.createAccount`/`setPermissions`/`updateStatus` — all permanent `AI_BLOCKED` exclusions like `refunds.process`. Only one CRITICAL example (`refunds.process`) was registered to keep the initial manifest focused; the pattern for registering any of the others (FORBIDDEN, `executionReference: null`) is now established and documented.
- `serviceEngagement`/`serviceMilestone` (escrow) and `EmailSequence` create/trigger — confirmed by Phase 0 to have zero implementing business logic. Registering a capability for a nonexistent service would violate the spec's core rule that every capability must correspond to a known, reviewed backend operation.
- `products.stockDecrement` — Phase 0 explicitly flags this as internal-only (purchase-driven, no caller identity confirmed, real double-decrement bug), never a human- or agent-facing capability.
