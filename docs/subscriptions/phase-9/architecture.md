# Architecture — Phase 9

## Execution path

```
MCP / gateway request
  → capability id + zod input validation (manifest schema, strict)
  → autonomy/authorization policy (existing evaluator; HIGH_RISK_MUTATION → REQUIRE_APPROVAL hard gate)
  → adapter dispatch (execution/resolver)
      → adapter.checkResource (owner-scope preflight, when a resource is targeted)
      → adapter.execute(ctx.ownerId, validated input)
          → existing Phase 3–6 service
  → audit ledger entry (existing chain) + observability
  → sanitized output (capability output schema)
```

## Files

- `lib/agent-gateway/capabilities/manifest.ts` — 8 Phase-9 capability
  definitions (schemas, risk tiers, permissions, side-effect metadata,
  execution references).
- `lib/agent-gateway/execution/adapters/subscription-read-adapters.ts` — 5 READ
  adapters + shared `assertOwnerSubscription` preflight.
- `lib/agent-gateway/execution/adapters/subscription-mutation-adapters.ts` — 3
  HIGH_RISK_MUTATION adapters (free enroll, trial start, cancel request).
- `lib/agent-gateway/execution/adapters/index.ts` — static registration (module-
  init fail-closed; same boundary as Phase-4 adapters).
- `lib/agent-gateway/tests/p16-subscription-governance.test.ts` — contract +
  adapter + ownership tests.

## Service dependencies (reused, never duplicated)

Phase-7 customer view (`getCustomerSubscriptionOverview`, `listCustomerPlans`),
Phase-3 resolver (`getEffectiveEntitlements`, `getLimit`), Phase-6
(`enrollFreePlan`, `startTrial`), Phase-4 (`cancelRecurringSubscription` —
customer-owner path only, `{ byAdmin }` never set by agents).