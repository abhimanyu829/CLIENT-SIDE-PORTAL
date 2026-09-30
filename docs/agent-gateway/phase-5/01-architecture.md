# Phase 5 — Remote MCP Server / External AI Connector

Status: IMPLEMENTED. Additive only — no existing route, service, or business flow was modified. This is a PROTOCOL ADAPTER: it does not add business logic, does not query Prisma directly, and does not bypass any Phase 1-4 boundary.

## 1. What this phase is

The remote interoperability layer that lets external AI platforms discover and call explicitly exposed Abhibhi capabilities over the Model Context Protocol (MCP):

```
EXTERNAL AI PLATFORM
        |
MCP CLIENT
        |
MCP TRANSPORT (Streamable HTTP)
        |
Abhibhi Agent Gateway (Phase 1)
        |
Agent Identity (Phase 2)
        |
Capability Registry (Phase 3)
        |
PHASE 6 AUTHORIZATION HOOK   <-- interface only, fails closed
        |
Phase 4 Adapter
        |
Existing Business Service
        |
Existing DB / Workers / Events / UI
```

This is explicitly not an AI agent, not an LLM, not Paperclip/Hermes/Claude/Codex, and not an agent runtime — it is only the connector external AI systems attach to.

## 2. Module location

`lib/agent-gateway/mcp/` — a new sibling module to Phase 1-4's `auth/`, `identity/`, `capabilities/`, `execution/`.

| File | Purpose |
|---|---|
| `config.ts` | `AGENT_GATEWAY_MCP_ENABLED` opt-in switch, mirroring Phase 1's config pattern |
| `errors.ts` | `McpSafeError`/`McpErrorCategory` — distinguishes TRANSPORT/PROTOCOL/AUTHENTICATION/AUTHORIZATION/CAPABILITY/EXECUTION/INTERNAL failures |
| `authorization-hook.ts` | `CapabilityAuthorizer` interface — the clean Phase 6 integration boundary, `FailClosedAuthorizer` (production default) |
| `transport-security.ts` | Host/Origin validation (the SDK's own equivalent options are deprecated) |
| `identity-context.ts` | Converts a verified `AgentGatewayRequestContext` into the SDK's `AuthInfo`, and back |
| `tool-projection.ts` | Projects Phase 3 `CapabilityDefinition`s onto MCP tools |
| `observability.ts` | MCP-layer event logging, reusing Phase 1's logger |
| `server.ts` | `createMcpServerForRequest()` — builds one `McpServer` with every exposed capability registered as a tool |
| `route-handler.ts` | `handleMcpRequest()` — the full pipeline entry point |
| `index.ts` | Public re-exports |

## 3. Route

`app/api/agent-gateway/mcp/route.ts` — the exact path Phase 1's `app/api/agent-gateway/route.ts` reserved in its own top comment. POST/GET/DELETE all delegate to `handleMcpRequest()`.

## 4. What this phase does NOT contain

No `AgentPolicy`/ABAC engine, no RBAC replacement, no approval engine, no autonomy engine, no quotas/budgets, no governance dashboard, no generic database/HTTP/shell/filesystem tools, no arbitrary code execution, no direct Prisma MCP tools, no secret-management or payment-credential tools, no new business logic or business services, no new agent runtime, no LLM integration.

## 5. Relationship to Phase 1-4

- **Phase 1**: `handleMcpRequest()` reuses `CompositeAuthenticator`, `GatewayRedisRateLimiter`, `validateMethod`/`validateContentType`/`validateBodySize`, and the existing `gatewayLogger`/`getAuditHook()` — no new authentication mechanism, no second rate limiter.
- **Phase 2**: identity is read exclusively from `AgentGatewayRequestContext.machine` (already verified by Phase 1/2) — never from any MCP protocol field.
- **Phase 3**: `tool-projection.ts` is a pure read-only view over `CapabilityRegistry` — it never redefines a schema, never mutates a capability.
- **Phase 4**: `server.ts`'s tool callback calls `AdapterResolver.execute()` directly — the exact same execution path Phase 4 already built and tested.
