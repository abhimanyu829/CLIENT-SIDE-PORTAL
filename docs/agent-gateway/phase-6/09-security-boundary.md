# Phase 6 — Security Boundary

## Deny-by-default, enforced at every layer

- **Unknown capability** — never reaches this module at all; Phase 5 only calls `authorize()` for a resolved, `AGENT_AVAILABLE`+`ACTIVE` Phase 3 capability.
- **No policy at all** — `DEFAULT_DENY_NO_POLICY`, the engine's own fallback when `resolvePrecedence()` finds no candidate.
- **Disabled capability, suspended/revoked/expired identity** — hard-security-deny layer in `engine.ts`, evaluated before any policy is consulted; no policy of any priority or scope can override it.
- **Policy evaluation error** — `POLICY_UNAVAILABLE`, enforced identically to deny at `authorizer.ts`.
- **Environment mismatch** — hard-security-deny (empty/missing environment) plus, independently, ENVIRONMENT-scoped policies never match a different environment value (no implicit cross-environment allowance exists anywhere).
- **Missing ownership context** — `IDENTITY_INVALID` hard deny when `connectionId`/`ownerId` are empty.
- **Malformed policy** — never matches (evaluates to `false`), never throws, never accidentally grants.

Every one of these is directly exercised by `authz-engine.test.ts`'s 30-scenario suite, `authz-security.test.ts`'s 25-attack suite, and `authz-failure.test.ts`'s fail-closed suite — 538/538 tests passing, described fully in `12-test-report.md`.

## Forged-input resistance

`context-builder.ts` is the ONLY place an `AuthorizationContext` is constructed, and it reads identity fields exclusively from the trusted `AgentExecutionContext` parameter — never from the raw `input` argument, even when that input contains keys shaped like `ownerId`, `teamId`, `agentId`, `connectionId`, or `permission`. Verified directly by `authz-security.test.ts`'s attacks #1-5, each supplying a forged-shaped input field and asserting the trusted context field wins.

## No arbitrary code execution surface

Covered fully in `05-policy-language.md`. Restated as a security property: there is no `eval`, no dynamic property access on the context object (closing the prototype-pollution surface — the one real bug this phase found and fixed), no SQL/HTTP/database call reachable from a stored condition, and no operator outside a fixed nine-item set. Verified by `authz-security.test.ts` attacks #10-15.

## Cross-tenant and cross-environment isolation

- **Cross-tenant**: an `OWNER`/`TEAM`/`CONNECTION`/`RESOURCE`-scoped grant for one identity never matches a different identity's request — verified by `authz-security.test.ts` #7/#8 and the full end-to-end cross-tenant test in `authz-end-to-end.test.ts`.
- **Cross-environment**: an `ENVIRONMENT`-scoped grant for `"production"` never matches a `"staging"`/`"development"` context, and vice versa — verified by `authz-resource-scope.test.ts`'s Section F suite (all six directional combinations) and the end-to-end `9/10. environment allowed / environment denied` test.

## Concurrency / race safety

No shared mutable state exists between two concurrent `authorize()` calls beyond the (read-mostly, cache-backed) policy set itself — `engine.ts`'s `evaluate()` is a pure function with no module-level state. Verified by `authz-concurrency.test.ts`: simultaneous calls for different connections never cross-contaminate, and a `disablePolicy()` that completes before a subsequent `authorize()` call is guaranteed to be observed by that call (no stale in-process caching of a decision — only policy *data* is ever cached, and only for 30 seconds, with explicit invalidation on every write).

## Error message safety

Covered fully in `11-error-model.md`. Restated: `errors.ts`'s `toAuthorizationError()` never includes a policy name, an internal reason code, or any other potentially-disclosing detail in the externally-thrown `AuthorizationDeniedError`'s message — every non-ALLOW decision collapses to one of three fixed, generic sentences. Verified by `authz-authorizer.test.ts`'s "the thrown error's message never contains the internal reason code or policy name" test, which deliberately names a policy `"SECRET_INTERNAL_POLICY_NAME"` and asserts it never leaks.
