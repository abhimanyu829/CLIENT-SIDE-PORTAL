/**
 * lib/agent-gateway/mcp/task-tools.ts
 *
 * Phase 8 — the three gateway-reserved MCP tools of the async Task Engine:
 *
 *   agent_task_submit   { capabilityId, input?, idempotencyKey? }
 *   agent_task_status   { taskRef }
 *   agent_task_cancel   { taskRef }
 *
 * Names contain underscores and no ".", so they can never collide with a
 * Phase 3 capability id (`domain.action`, letters/digits only) — and the
 * server refuses to start if one ever did.
 *
 * Identity always comes from the verified AuthInfo (Phase 1/2), never from
 * tool arguments. Submission goes through the ExecutionGate inside the
 * Task Engine; status and cancel are owner-scoped: a foreign, unknown or
 * malformed task reference gets the identical TASK_NOT_FOUND answer.
 */
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { AgentGatewayRequestContext } from "../shared/types"
import type { AgentTaskService } from "../tasks/engine"
import { TaskError } from "../tasks/errors"
import { extractTrustedIdentity } from "./identity-context"
import { AuthorizationDeniedError, toMcpSafeError } from "./errors"
import { recordMcpEvent } from "./observability"
import { toolSuccessResult } from "./content-result"

export const TASK_TOOL_NAMES = {
  SUBMIT: "agent_task_submit",
  STATUS: "agent_task_status",
  CANCEL: "agent_task_cancel",
} as const

const submitSchema = z
  .object({
    capabilityId: z.string().min(1).max(80),
    input: z.record(z.unknown()).optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict()

const refSchema = z.object({ taskRef: z.string().min(1).max(64) }).strict()

function ok(payload: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload, isError: false }
}

function fail(code: string, message: string): CallToolResult {
  return { content: [{ type: "text", text: `${code}: ${message}` }], isError: true }
}

function toResult(err: unknown): CallToolResult {
  if (err instanceof TaskError) return fail(err.code, err.message)
  if (err instanceof AuthorizationDeniedError) return fail(err.code, err.message)
  const safe = toMcpSafeError(err)
  return fail(safe.code, safe.message)
}

/** Throws at server construction if a reserved name is ever shadowed by a capability tool. */
export function assertNoTaskToolCollision(existingToolNames: readonly string[]): void {
  for (const name of Object.values(TASK_TOOL_NAMES)) {
    if (existingToolNames.includes(name)) throw new Error(`MCP tool name collision: "${name}" is reserved for the Task Engine.`)
  }
}

export function registerTaskTools(
  server: McpServer,
  service: AgentTaskService,
  gatewayContext: AgentGatewayRequestContext,
  environment: string
): void {
  const record = (toolName: string, outcome: "ALLOWED" | "DENIED", startedAt: number, errorCode?: string) =>
    recordMcpEvent({
      event: outcome === "ALLOWED" ? "adapter_completed" : "adapter_failed",
      requestId: gatewayContext.requestId,
      connectionId: gatewayContext.machine?.connectionId,
      toolName,
      errorCode,
      durationMs: Date.now() - startedAt,
    })

  server.registerTool(
    TASK_TOOL_NAMES.SUBMIT,
    {
      title: "Submit an asynchronous task",
      description:
        "Runs an async-capable capability in the background under the same authorization, autonomy and approval rules as a direct call. Returns a task reference to poll with agent_task_status.",
      inputSchema: submitSchema,
    },
    async (args, extra) => {
      const startedAt = Date.now()
      try {
        extractTrustedIdentity(extra.authInfo)
        const { task, created } = await service.submit(gatewayContext, environment, {
          capabilityId: args.capabilityId,
          input: args.input ?? {},
          idempotencyKey: args.idempotencyKey,
        })
        record(TASK_TOOL_NAMES.SUBMIT, "ALLOWED", startedAt)
        return ok({ ...task, created })
      } catch (err) {
        const result = toResult(err)
        record(TASK_TOOL_NAMES.SUBMIT, "DENIED", startedAt, (result.content[0] as { text: string }).text.split(":")[0])
        return result
      }
    }
  )

  server.registerTool(
    TASK_TOOL_NAMES.STATUS,
    {
      title: "Get an asynchronous task's status",
      description: "Returns the status of one of your own tasks, and its result once it has succeeded.",
      inputSchema: refSchema,
    },
    async (args, extra) => {
      const startedAt = Date.now()
      try {
        const identity = extractTrustedIdentity(extra.authInfo)
        const { view, content } = await service.getStatusWithContent({ connectionId: identity.connectionId, ownerId: identity.ownerId }, args.taskRef)
        record(TASK_TOOL_NAMES.STATUS, "ALLOWED", startedAt)
        // Phase 12: a stored capability result carries the same content notice as a direct call.
        return view.result !== undefined ? toolSuccessResult({ ...view }, content) : ok({ ...view })
      } catch (err) {
        const result = toResult(err)
        record(TASK_TOOL_NAMES.STATUS, "DENIED", startedAt, (result.content[0] as { text: string }).text.split(":")[0])
        return result
      }
    }
  )

  server.registerTool(
    TASK_TOOL_NAMES.CANCEL,
    {
      title: "Cancel an asynchronous task",
      description:
        "Cancels one of your own tasks. Queued work is cancelled; running work is cancelled only when the capability supports it, otherwise CANCELLATION_UNAVAILABLE is returned.",
      inputSchema: refSchema,
    },
    async (args, extra) => {
      const startedAt = Date.now()
      try {
        const identity = extractTrustedIdentity(extra.authInfo)
        const { outcome, task } = await service.cancel({ connectionId: identity.connectionId, ownerId: identity.ownerId }, args.taskRef)
        record(TASK_TOOL_NAMES.CANCEL, "ALLOWED", startedAt)
        return ok({ outcome, ...task })
      } catch (err) {
        const result = toResult(err)
        record(TASK_TOOL_NAMES.CANCEL, "DENIED", startedAt, (result.content[0] as { text: string }).text.split(":")[0])
        return result
      }
    }
  )
}
