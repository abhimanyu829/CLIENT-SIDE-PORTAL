# Phase 3 — Capability Architecture

Status: IMPLEMENTED. Additive only — no existing route, service, or business flow was modified. This is a registry/description/validation layer with no HTTP surface and no execution engine.

## 1. What this phase is

A secure, explicit, versioned, typed **registry** that describes which existing backend capabilities MAY eventually be exposed to AI agents and exactly how they are shaped. It sits between Phase 2's machine identity and the future Phase 4 execution adapters:

```
EXTERNAL AI PLATFORM
        |
Abhibhi Agent Gateway (Phase 1)
        |
Machine Identity / AgentConnection (Phase 2)
        |
PHASE 3 CAPABILITY REGISTRY   <-- this phase
        |
PHASE 4 EXECUTION ADAPTERS    (not built)
        |
EXISTING BUSINESS SERVICES
        |
EXISTING DATABASE / EVENTS / WORKERS / UI
```

## 2. What this phase is NOT

Not the policy engine, not the approval engine, not the autonomy engine, not MCP, not a business execution engine, not an admin governance dashboard, not a generic API proxy, not a generic database tool, not a generic function executor. Registering a capability here makes it **describable**, never **callable** — there is no executor, no HTTP discovery endpoint, and no MCP server in this codebase yet.

## 3. Module location

`lib/agent-gateway/capabilities/` — a new sibling module to Phase 1/2's `auth/`, `identity/`, `routing/`, etc., following the exact directory-per-concern convention already established.

| File | Purpose |
|---|---|
| `types.ts` | `CapabilityDefinition` and all supporting metadata types |
| `id.ts` | Capability id/version parsing and validation |
| `errors.ts` | `CapabilityError` — the registry's own error contract |
| `dangerous-primitive-guard.ts` | Static rejection of forbidden primitive references |
| `schema-validation.ts` | Thin zod wrapper for input validation |
| `registry.ts` | `CapabilityRegistry` — the core store |
| `manifest.ts` | The actual, reviewed capability definitions |
| `index.ts` | Singleton accessor + public re-exports |

## 4. Why no HTTP surface in Phase 3

The spec explicitly forbids building MCP, a public discovery endpoint, or exposing all capability metadata indiscriminately in this phase. The registry is consumed exclusively as an internal library (`import { getCapabilityRegistry } from "@/lib/agent-gateway/capabilities"`) — there is nothing for an external caller to reach yet. This also means Phase 3 required **zero new API routes**, zero new admin UI, and zero new database migrations.

## 5. Relationship to Phase 0/1/2

- Phase 0's `CAPABILITY-MATRIX.md`, `RISK-MATRIX.md`, and `AI-EXPOSURE-CANDIDATES.md` are the direct source of every capability registered in `manifest.ts` — none are invented.
- Phase 2's `AgentMachineIdentity` shape (`connectionId`, `ownerId`, `teamId`) is what `CapabilityDefinition.requiredIdentityContext` declares against — verified by an integration test that checks every registered capability's required fields are satisfiable by the real identity shape.
- Phase 1's `GatewayError` pattern is the direct model for this phase's own `CapabilityError` — same shape (`code`, `message`), deliberately a **separate class** (see `07-security-boundary.md` for why).

## 6. Core design decisions

1. **Code-first, version-controlled manifest** — no new Prisma model, no new database table. The spec explicitly prefers this over a persistence layer unless Phase 0 established a strong reason otherwise; it did not.
2. **Existing risk classification reused verbatim** — `RiskTier` is exactly Phase 0's four tiers (`READ`, `LOW_RISK_WRITE`, `HIGH_RISK_MUTATION`, `CRITICAL`). No second, conflicting risk system.
3. **Existing RBAC reused, never invented** — `permission.permission` stores a literal from `lib/permissions.ts`'s `PERMISSIONS` constants where one exists; documented as `null` with a `note` where it does not (see `06-risk-and-side-effect-metadata.md`).
4. **Existence != authorization** — see `07-security-boundary.md` for the full exposure-level model.
