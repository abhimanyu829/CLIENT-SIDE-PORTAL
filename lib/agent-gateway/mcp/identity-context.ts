/**
 * lib/agent-gateway/mcp/identity-context.ts
 *
 * The ONE place an MCP `AuthInfo` (from the SDK) is converted into an
 * `AgentExecutionContext` (Phase 4). `AuthInfo.extra` is where the
 * ALREADY-VERIFIED Phase 1/2 machine identity is carried — see
 * `mcp/server.ts`'s `buildAuthInfo()`, the ONE place an `AuthInfo` is
 * ever constructed, always from a verified `AgentGatewayRequestContext`,
 * never from any client-supplied MCP protocol field (`clientInfo` is
 * explicitly untrusted metadata per the master prompt and is never read
 * here).
 */
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { AgentGatewayRequestContext, AgentConnectionStatusValue } from "../shared/types"
import { ExecutionError } from "../execution/contracts/execution-error"

/** The shape stored in AuthInfo.extra — internal to this module, never part of the public MCP contract. */
export interface McpTrustedIdentityExtra {
  connectionId: string
  ownerId: string
  teamId?: string | null
  agentId?: string
  connectionStatus: AgentConnectionStatusValue
  environment: string
}

const TRUSTED_IDENTITY_KEY = "abhibhi.trustedIdentity"

export function buildAuthInfoExtra(gatewayContext: AgentGatewayRequestContext, environment: string): Record<string, unknown> {
  const machine = gatewayContext.machine
  if (!machine) {
    throw new ExecutionError("FORBIDDEN", "No verified machine identity is present on this request.")
  }
  const trusted: McpTrustedIdentityExtra = {
    connectionId: machine.connectionId,
    ownerId: machine.ownerId,
    teamId: machine.teamId,
    agentId: machine.agentId,
    connectionStatus: machine.connectionStatus,
    environment,
  }
  return { [TRUSTED_IDENTITY_KEY]: trusted }
}

/**
 * Extracts the trusted identity from an `AuthInfo` that was built by
 * `buildAuthInfoExtra()` above. Throws if absent or malformed — this
 * function is the fail-closed boundary between "the SDK gave us some
 * AuthInfo" and "we have a verified machine identity we can trust for
 * execution." A tool handler must NEVER proceed without calling this.
 */
export function extractTrustedIdentity(authInfo: AuthInfo | undefined): McpTrustedIdentityExtra {
  const extra = authInfo?.extra?.[TRUSTED_IDENTITY_KEY] as McpTrustedIdentityExtra | undefined
  if (!extra || typeof extra !== "object" || !extra.connectionId || !extra.ownerId) {
    throw new ExecutionError("FORBIDDEN", "No verified machine identity is present on this request.")
  }
  return extra
}
