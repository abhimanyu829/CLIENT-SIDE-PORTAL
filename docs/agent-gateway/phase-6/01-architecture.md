# Phase 6 — Architecture

## Where Phase 6 sits

```
External AI
    |
MCP / Gateway              (Phase 5 — transport/protocol, UNCHANGED)
    |
Identity                   (Phase 1/2 — authentication, connection lifecycle, UNCHANGED)
    |
Capability                 (Phase 3 — capability registry/schema/risk metadata, UNCHANGED)
    |
PHASE 6 AUTHORIZATION       <-- this phase
    |
Phase 4 Execution           (adapters, UNCHANGED)
    |
Existing Business Logic     (UNCHANGED)
```

Phase 6's entire footprint is one new module (`lib/agent-gateway/authorization/`), one new pair of Prisma models (`AgentPolicy`/`AgentPolicyVersion`), and exactly one line changed in an existing file (`lib/agent-gateway/mcp/route-handler.ts`, replacing `new FailClosedAuthorizer()` with `new PolicyEngineAuthorizer()`).

## The three questions, kept separate

Per the spec's primary principle:
- **Authentication** ("WHO is calling?") — answered entirely by Phase 1/2, never touched by this phase.
- **Authorization** ("WHAT may that identity do?") — this phase's entire job.
- **Execution** ("HOW does the operation happen?") — Phase 4's job, never touched by this phase.

No file in `lib/agent-gateway/authorization/` imports from `lib/agent-gateway/auth/`, `lib/agent-gateway/identity/`, or `lib/agent-gateway/transport/` (Phase 1/2's authentication modules) — the only identity data this phase consumes arrives already-verified, via `AgentExecutionContext` (Phase 4's own trusted contract). Nor does any file in this module call a Phase 4 adapter, query a business-domain Prisma model, or otherwise perform execution — the module's only Prisma models are its own (`AgentPolicy`/`AgentPolicyVersion`).

## Module layout

```
lib/agent-gateway/authorization/
├── types.ts              AuthorizationContext, AuthorizationDecision, reason codes, policy model types, condition-tree types
├── policy-language.ts    the constrained ABAC condition evaluator + write-time validator (no code execution possible)
├── precedence.ts         deterministic precedence resolution over a matched candidate set
├── engine.ts             evaluate(context, policySet) -> AuthorizationDecision — pure, no I/O
├── context-builder.ts    builds AuthorizationContext from Phase 4's AgentExecutionContext + Phase 3's CapabilityDefinition
├── policy-store.ts       the ONLY place AgentPolicy/AgentPolicyVersion rows are read or written; Redis cache
├── rbac-bridge.ts        read-only reuse of lib/permissions.ts's PERMISSIONS vocabulary
├── errors.ts             AuthorizationDecision -> AuthorizationDeniedError (Phase 5's error type, reused not duplicated)
├── observability.ts      safe-metadata-only logging via Phase 5's gatewayLogger
├── authorizer.ts         PolicyEngineAuthorizer — the real CapabilityAuthorizer implementation, fail-closed on any internal error
├── simulate.ts           simulateAuthorization() — internal-only, for tests / a future governance UI
├── seed.ts                seedBaselineReadPolicies() — optional, explicit-invocation-only bootstrap
└── index.ts               barrel
```

## Data flow for one `tools/call`

1. Phase 5's `mcp/server.ts` resolves the tool, builds an `AgentExecutionContext` (Phase 4), and calls `authorizer.authorize(context, capability, input, {})` — **exactly the same call site Phase 5 already had**, now hitting `PolicyEngineAuthorizer` instead of `FailClosedAuthorizer`.
2. `context-builder.ts` converts `(AgentExecutionContext, CapabilityDefinition, input)` into an `AuthorizationContext` — copying every trusted identity field verbatim, reading risk/exposure/permission metadata from the capability, and best-effort-extracting a `resourceId` from `input` using the capability's own declared locator field name (never trusting it as an ownership proof — see `03-resource-scope-boundary.md`).
3. `policy-store.ts`'s `loadActivePolicySet()` returns the current active policy set (cache-first, DB-fallback, fail-closed on total failure).
4. `engine.ts`'s `evaluate()` runs hard-security checks, matches candidate policy versions against the context, and resolves precedence deterministically — returning one `AuthorizationDecision`.
5. `authorizer.ts` either returns (ALLOW) or throws `AuthorizationDeniedError` (DENY / REQUIRES_APPROVAL / POLICY_UNAVAILABLE — all three enforced identically as a throw).
6. Only on a normal return does Phase 5 proceed to call Phase 4's `AdapterResolver.execute()`.

## What Phase 6 explicitly does not touch

Confirmed by inspection and by the protected-system verification in `16-phase-6-exit-checklist.md`: zero changes to `lib/agent-gateway/transport/`, `auth/`, `security/`, `limits/`, `identity/`, `capabilities/`, `execution/` (except the one documented backward-compatible read in Phase 4's `registry.get()` from Phase 5, unrelated to this phase), `mcp/server.ts`, `mcp/authorization-hook.ts`, `lib/permissions.ts`, `lib/subadmin-permission-policy.ts`, `lib/admin-auth.ts`, any `app/(admin)/` file, or any existing business-domain Prisma model.
