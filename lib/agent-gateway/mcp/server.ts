/**
 * lib/agent-gateway/mcp/server.ts
 *
 * Phase 5 — the MCP server core. Wires:
 *
 *   Phase 3 CapabilityRegistry  --(tool-projection.ts)-->  MCP tools/list
 *   MCP tools/call  --(this file's orchestration)-->  authorizeCapability() [Phase 6 hook]
 *                                                  --> Phase 4 AdapterResolver.execute()
 *
 * This module contains NO business logic. It never queries Prisma
 * directly, never bypasses Phase 1 authentication (the caller — see
 * mcp/route-handler.ts — is responsible for having already produced a
 * verified AgentGatewayRequestContext before this module is touched),
 * never bypasses Phase 2 identity, Phase 3 capability definitions, or
 * Phase 4 adapters.
 *
 * One McpServer instance per request is used deliberately (see
 * `createMcpServerForRequest()`) — this is a stateless deployment
 * (`sessionIdGenerator` left undefined on the transport), so there is no
 * benefit to a long-lived, shared server/transport pair, and a per-request
 * instance trivially avoids any accidental state leaking between two
 * different connections' requests.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js"
import type { ServerRequest, ServerNotification, CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import type { CapabilityRegistry } from "../capabilities/registry"
import type { AdapterRegistry } from "../execution/resolver/adapter-registry"
import { AdapterResolver } from "../execution/resolver/adapter-resolver"
import { projectTools, resolveProjectedTool, toolAnnotationsFor } from "./tool-projection"
import { extractTrustedIdentity } from "./identity-context"
import { toolSuccessResult } from "./content-result"
import { IDEMPOTENCY_META_KEY, idempotencyKeyFromMeta } from "./request-meta"
import { installStableToolErrors } from "./tool-errors"
import { CapabilityError } from "../capabilities/errors"
import { isInputHygieneDetails } from "../security/input-hygiene"
import { recordInputRejected } from "../security/evidence"
import { toMcpSafeError, AuthorizationDeniedError } from "./errors"
import type { CapabilityAuthorizer } from "./authorization-hook"
import { buildExecutionContext } from "../execution/resolver/build-execution-context"
import type { AgentGatewayRequestContext } from "../shared/types"
import { recordMcpEvent } from "./observability"
import type { AgentTaskService } from "../tasks/engine"
import { assertNoTaskToolCollision, registerTaskTools } from "./task-tools"

export interface McpServerDependencies {
  capabilityRegistry: CapabilityRegistry
  adapterRegistry: AdapterRegistry
  authorizer: CapabilityAuthorizer
  /**
   * Phase 8 — when present, the three reserved async task tools
   * (agent_task_submit / _status / _cancel) are registered. Absent (the
   * default, and whenever AGENT_GATEWAY_TASKS_ENABLED is off) the tool
   * surface is exactly Phase 5's.
   */
  taskService?: AgentTaskService
  /**
   * Phase 15 — capability ids this connection may currently use under the
   * release controls (rollout/controls.ts visibleCapabilities). When given,
   * nothing else is listed or callable as a tool; the gate re-checks on
   * every call regardless.
   */
  visibleCapabilityIds?: ReadonlySet<string>
}

const MCP_SERVER_NAME = "abhibhi-agent-gateway"
const MCP_SERVER_VERSION = "1.0.0"

/**
 * Builds a fresh McpServer for one request, with every Phase-3-exposed
 * capability registered as a tool. `gatewayContext` must already carry a
 * verified `machine` identity — this function does not authenticate
 * anything itself (see mcp/route-handler.ts for where that happens).
 */
export function createMcpServerForRequest(
  deps: McpServerDependencies,
  gatewayContext: AgentGatewayRequestContext,
  environment: string
): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } } // Only advertise tools — no resources/prompts in this phase (spec: do not build them without an explicit safe use case).
  )

  // Phase 14 (P14-F1): SDK-originated tool errors never reflect agent input.
  installStableToolErrors(server)

  const resolver = new AdapterResolver(deps.capabilityRegistry, deps.adapterRegistry)
  // Phase 12: executable-only — a capability without a registered adapter is never a tool.
  const tools = projectTools(deps.capabilityRegistry, deps.adapterRegistry).filter((t) => !deps.visibleCapabilityIds || deps.visibleCapabilityIds.has(t.capability.id))

  if (deps.taskService) {
    assertNoTaskToolCollision(tools.map((t) => t.name))
    registerTaskTools(server, deps.taskService, gatewayContext, environment)
  }

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        // Phase 3 remains authoritative: pass its own zod schema straight
        // through, never redefine it here.
        inputSchema: tool.capability.inputSchema ?? undefined,
        outputSchema: tool.capability.outputSchema ?? undefined,
        // Phase 12: client hints derived from Phase 3 metadata (never a control).
        annotations: toolAnnotationsFor(tool.capability),
      },
      async (args: unknown, extra: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> => {
        const startedAt = Date.now()
        try {
          const identity = extractTrustedIdentity(extra.authInfo)
          void identity // already embedded in gatewayContext.machine; extracted here only to fail closed if it's somehow absent from this specific call's AuthInfo.

          // Re-resolve the tool at call time — a capability could have
          // been disabled between tools/list and tools/call.
          const resolved = resolveProjectedTool(deps.capabilityRegistry, tool.name, deps.adapterRegistry)
          if (!resolved) {
            return errorResult("CAPABILITY_NOT_FOUND", `Tool "${tool.name}" is not currently available.`)
          }

          // Phase 13: a write's idempotency key travels in params._meta (request-meta.ts).
          const keyFromMeta = idempotencyKeyFromMeta(extra._meta)
          if (!keyFromMeta.ok) return errorResult("INVALID_INPUT", keyFromMeta.message)
          if (resolved.capability.idempotency.requiresIdempotencyKey && !keyFromMeta.key) {
            return errorResult(
              "IDEMPOTENCY_KEY_REQUIRED",
              `Tool "${tool.name}" requires an idempotency key: pass params._meta["${IDEMPOTENCY_META_KEY}"], or submit it with agent_task_submit and an idempotencyKey.`
            )
          }

          // Phase 12: input hygiene (and the Phase 3 schema) BEFORE the gate,
          // so a hostile input never reaches an approval request a human reads.
          try {
            deps.capabilityRegistry.validateInput(`${resolved.capability.id}@v${resolved.capability.version}`, args)
          } catch (err) {
            if (err instanceof CapabilityError) {
              if (isInputHygieneDetails(err.details)) {
                recordInputRejected(
                  { connectionId: gatewayContext.machine?.connectionId, ownerId: gatewayContext.machine?.ownerId, capabilityId: resolved.capability.id, requestId: gatewayContext.requestId },
                  err.details.hygiene,
                  err.details.path,
                  "MCP"
                )
              }
              return errorResult("INVALID_INPUT", err.message)
            }
            throw err
          }

          // Phase 6 authorization hook — fails closed by default (see
          // authorization-hook.ts). This call happens BEFORE any Phase 4
          // adapter is ever reached.
          const execContext = buildExecutionContext(gatewayContext, resolved.capability.id, resolved.capability.version, environment)
          try {
            await deps.authorizer.authorize(execContext, resolved.capability, args, {})
          } catch (err) {
            if (err instanceof AuthorizationDeniedError) {
              recordMcpEvent({
                event: "authorization_result",
                requestId: gatewayContext.requestId,
                connectionId: gatewayContext.machine?.connectionId,
                toolName: tool.name,
                outcome: "DENIED",
                durationMs: Date.now() - startedAt,
              })
              return errorResult(err.code, err.message)
            }
            throw err
          }
          recordMcpEvent({
            event: "authorization_result",
            requestId: gatewayContext.requestId,
            connectionId: gatewayContext.machine?.connectionId,
            toolName: tool.name,
            outcome: "ALLOWED",
            durationMs: Date.now() - startedAt,
          })

          recordMcpEvent({
            event: "adapter_started",
            requestId: gatewayContext.requestId,
            connectionId: gatewayContext.machine?.connectionId,
            toolName: tool.name,
          })
          const result = await resolver.execute(`${resolved.capability.id}@v${resolved.capability.version}`, args, gatewayContext, keyFromMeta.key)
          recordMcpEvent({
            event: "adapter_completed",
            requestId: gatewayContext.requestId,
            connectionId: gatewayContext.machine?.connectionId,
            toolName: tool.name,
            durationMs: Date.now() - startedAt,
          })

          // Phase 12: the content notice + trust annotation travel with the data.
          return toolSuccessResult(result.output as Record<string, unknown>, result.content)
        } catch (rawErr) {
          const safe = toMcpSafeError(rawErr)
          recordMcpEvent({
            event: "adapter_failed",
            requestId: gatewayContext.requestId,
            connectionId: gatewayContext.machine?.connectionId,
            toolName: tool.name,
            errorCode: safe.code,
            durationMs: Date.now() - startedAt,
          })
          return errorResult(safe.code, safe.message)
        }
      }
    )
  }

  // Phase 15: with every tool hidden (kill switch, unreleased capabilities)
  // and no task tools, the SDK would never install its tools handlers, so
  // tools/list and tools/call would fail with "method not found". An agent
  // must see an empty surface and a stable refusal instead.
  if (tools.length === 0 && !deps.taskService) {
    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }))
    server.server.setRequestHandler(CallToolRequestSchema, async () => errorResult("CAPABILITY_NOT_FOUND", "The requested tool is not available."))
  }

  return server
}

function errorResult(code: string, message: string): CallToolResult {
  return {
    content: [{ type: "text", text: `${code}: ${message}` }],
    isError: true,
  }
}
