# Phase 6 — Observability

## Reuses Phase 1/5's logger, not a new stack

`authorization/observability.ts`'s `recordAuthorizationEvent()` writes through the exact same `gatewayLogger` (pino) instance Phase 5's `mcp/observability.ts` already uses (`lib/agent-gateway/observability/request-log.ts`). No new logging library, destination, or format is introduced.

## Safe fields only

Per the spec's exact list: `requestId`, `connectionId`, `capabilityId`, `resourceType`, `resourceId` (already just an id string — never a full record, never a resource's other fields), `policyId`, `policyVersion`, `decision`, `reasonCode`, `evaluationDurationMs`. Never logged: tokens, credentials, secrets, full request/response payloads, other tenants' data, or a policy's stored *condition tree* (which could indirectly describe internal business rules the spec's error-semantics section says not to disclose). This is enforced structurally — `AuthorizationEventFields`'s type has no field capable of carrying any of those, so there is no accidental-inclusion risk from a future call site passing "everything it has."

## Severity routing

`ALLOW` decisions log at `info`; every other decision (`DENY`, `REQUIRES_APPROVAL`, `POLICY_UNAVAILABLE`) logs at `warn` — this lets existing log-based alerting (already tuned for Phase 1/5's `warn`-level gateway events) pick up authorization denials with zero additional configuration.

## Where it's called

Exactly once per `authorize()` invocation, inside `authorizer.ts`, immediately after a decision is produced (whether from a successful evaluation or from the `POLICY_UNAVAILABLE` fallback) and before the function either returns or throws. This guarantees every authorization attempt — allowed or denied — produces exactly one log line, with the same `requestId` Phase 1/5 already generated for the overall MCP request, enabling full request-scoped correlation across authentication, authorization, and execution log lines without a separate correlation-id scheme.

## Stable reason codes, not free-text

Every log line's `reasonCode` field is one of the fixed `AuthorizationReasonCode` union values (`02-authorization-model.md`), never a free-form string built from policy content — an operator can grep/alert on `reasonCode:"CONNECTION_SUSPENDED"` reliably across every log line ever produced by this module, without needing to parse a human-readable message.

## What this is not

Explicitly not Phase 11's future audit ledger (which the master prompt notes should not be built yet) — this is operational logging only, with the same retention/rotation/access characteristics as every other pino log line this app already produces. Traceability back to a specific policy version (for a human reviewing "why was this decision made") is achieved via `matchedPolicyId`/`matchedPolicyVersion` in the decision object itself (see `02-authorization-model.md`), combined with the always-immutable, always-versioned `AgentPolicyVersion` history (`08-policy-versioning-and-cache.md`) — an operator can look up the exact policy version referenced in any historical log line and see precisely what rule it contained, even if that policy has since been superseded many times.
