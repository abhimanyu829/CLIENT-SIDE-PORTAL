# Security — Phase 9

## Data isolation

- Every adapter reads/writes through owner-scoped services; cross-tenant
  attempts return the same `RESOURCE_NOT_FOUND` (tested: owner_b sees an empty
  view; cancel of a non-owned subscription is rejected before the provider
  call).
- Outputs are trimmed to capability schemas: no provider subscription ids,
  no secrets, no metadata bags, no invoice/charge internals beyond the
  declared safe fields.

## Prompt injection

- Policy enforcement is server-side (registry + evaluator); retrieved
  customer content is data, never instructions (fixed zod schemas; dynamic
  tool definitions impossible).
- Tool permissions cannot be selected by the model; unknown tools rejected.

## Safe execution

- No SQL/Prisma/shell/provider-access surfaces; adapters call Phases 3–6
  services only.
- Mutation error normalization prevents internal detail leakage.
- Agent calls can never set `{ byAdmin }` (cancel adapter uses the plain
  customer-owner path).

## Rate limiting / abuses

Reuses gateway edge controls (limiter + nonce store) already enforced on the
MCP route; no new infrastructure added.

## Tests

`p16-subscription-governance.test.ts` (14): manifest registration/risk
classification/strict schemas; adapter contracts; owner scoping; cross-tenant
denial; checkResource approval preflight; unknown-resource denial; service
delegation arguments.