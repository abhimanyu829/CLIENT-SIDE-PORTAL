# Phase 6 — Resource-Scope Boundary (Phase 6 vs. Phase 4, disclosed explicitly)

## The boundary, stated plainly

Phase 6 does **not** query any business-domain table (Product, Subscription, Ticket, etc.) to verify a resource's real ownership. It only evaluates declarative conditions over the trusted `AuthorizationContext` — which includes a `resourceId` field that this module extracts, but never independently verifies against a database.

**True per-record ownership verification remains, unchanged, Phase 4's job.** `subscriptions-get-adapter.ts` and `tickets-list-adapter.ts` (Phase 4) already enforce `WHERE ownerId = context.ownerId` at the actual database query — this is the real security boundary for "does resource X belong to this caller," and Phase 6 does not re-implement, duplicate, or weaken it.

## Why this boundary exists (not an oversight)

1. **"No business logic" constraint.** The master prompt is explicit: Phase 6 must not implement business logic or a new database CRUD API. Querying `Product`/`Subscription`/`Ticket` tables directly from the authorization layer would be exactly that — a second, competing place resource ownership gets decided, with its own risk of drifting out of sync with Phase 4's adapter logic over time.
2. **Single source of truth.** Phase 4's adapters are the Phase-4-documented, Phase-4-tested authority for "what does this capability actually return, scoped how." Phase 6 authorizing "may this connection call `subscriptions.get` at all, and does any RESOURCE-scoped policy apply to this specific id" is a different, narrower question than "does this specific subscription row belong to this owner" — the latter question is answered downstream, by Phase 4, exactly as it always was.
3. **`resourceId` is derived from unvalidated input.** `context-builder.ts`'s `extractResourceId()` reads a raw tool-call argument (before Phase 4's resolver has even validated it against the Phase 3 zod schema) using the field name the capability itself declares (`capability.resource.resourceLocator`). This is explicitly a best-effort value for RESOURCE-scope policy *matching* only — e.g. "does an explicit deny exist for this exact id" — never treated as proof that the id is well-formed, exists, or belongs to the caller.

## What this means in practice

- A `RESOURCE`-scoped `DENY` policy for id `"prod_123"` will correctly block a call whose extracted `resourceId` is `"prod_123"`, regardless of whether that product actually exists or who owns it — this is a coarse, administrator-authored blocklist mechanism, not a substitute for ownership checks.
- A `RESOURCE`-scoped `ALLOW` (or the absence of any RESOURCE-scope restriction) does **not** mean the caller can necessarily read that resource — if Phase 4's adapter query finds the resource belongs to a different owner, the adapter still returns `RESOURCE_NOT_FOUND`, exactly as it did before Phase 6 existed. Verified end-to-end by `authz-end-to-end.test.ts`'s "cross-tenant isolation through the full pipeline still holds with a real policy engine wired in" test: the policy layer ALLOWs the capability call, and Phase 4's own adapter still correctly denies at the DB layer for a cross-tenant resource.

## `authenticationStrength` — a related, smaller documented gap

`AuthorizationContext.authenticationStrength` defaults to `"BEARER"` when not explicitly supplied, because `AgentExecutionContext` (Phase 4's own contract, which this phase must not modify) does not carry the auth method used for the request — only the broader `AgentGatewayRequestContext` (Phase 1/5) does, and Phase 5's `mcp/server.ts` call site only ever passes the narrower `AgentExecutionContext` into `authorize()`. No currently-seeded policy uses `request.authenticationStrength` as a condition attribute, so this default has zero live behavioral effect today. Closing this gap cleanly would require Phase 5 to thread `authMethod` through `AgentExecutionContext` the same way it already threads every other trusted field — a small, well-scoped Phase 5 change, deliberately not made here since Phase 6's mandate is to build the authorization layer without rewriting Phase 5's contracts.
