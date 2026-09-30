# Phase 7 — Architecture

Phase 7 adds governance between "is this agent allowed?" (Phase 6) and "run it" (Phase 4): autonomy levels, human approval requests, and an execution gate that re-checks everything immediately before an adapter runs.

## Request path

```
MCP tools/call (Phase 5)
  -> identity (Phase 1/2, per request)
  -> capability resolution (Phase 3)
  -> ExecutionGate.authorize()                     lib/agent-gateway/execution-gate/gate.ts
       1. identity re-check (ACTIVE, owner, connection)
       2. Phase 6 PolicyEngineAuthorizer.decide()  (fresh)
       3. autonomy policy load                      (fresh DB read, no cache)
       4. resolveAutonomyDecision()                 (pure)
       5. ALLOW -> return | DENY -> throw
       6. REQUIRE_APPROVAL -> binding digest -> consume matching APPROVED approval
                              atomically, or create/return a PENDING request
  -> Phase 4 adapter (only if the gate returned)
```

The gate implements Phase 5's existing `CapabilityAuthorizer` interface, so Phase 5's tool callback and Phase 4's resolver are unchanged. The only wiring change is one line in `mcp/route-handler.ts`:

```ts
authorizer: new ExecutionGate({ authorization: new PolicyEngineAuthorizer() })
```

## Human path (separate, never agent-reachable)

```
Browser (Clerk session) -> /admin/agent-approvals/[ref]   (page, read-only on load)
  -> POST /api/admin/agent-approvals/[ref]/step-up         (SMS code to verified phone)
  -> POST /api/admin/agent-approvals/[ref]/decision        (APPROVE: digest + code; REJECT: digest)
  -> POST /api/admin/agent-approvals/[ref]/cancel
  -> PUT  /api/admin/agent-connections/[id]/autonomy       (autonomy policy, SUPER_ADMIN)
```

All human routes go through `requireHumanApprover()` (existing `requireSuperAdmin()` + Clerk session id) and refuse any request carrying an Agent Gateway credential.

## Modules

| Module | Responsibility |
|---|---|
| `autonomy/` | Levels, pure evaluator, mandatory approval rules, policy store (no cache) |
| `approvals/` | Canonical JSON, binding digest, state machine, expiry, redaction, request service (agent side), decision service (human side), human session resolver, query service |
| `human-in-the-loop/cua-contract.ts` | Cua trust boundary: surface descriptor, observation interpretation, health-report parsing. Never calls Cua |
| `execution-gate/` | The gate and its observability |

## What Phase 7 does not do

No task engine, scheduling, webhooks, governance dashboard, audit ledger or rollback (Phase 8+). No business logic, payment or deployment changes. No new identity, RBAC or auth system.
