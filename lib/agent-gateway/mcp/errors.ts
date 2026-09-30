/**
 * lib/agent-gateway/mcp/errors.ts
 *
 * Phase 5 error model. MCP is a PROTOCOL ADAPTER — it must distinguish
 * transport errors, protocol (JSON-RPC/MCP) errors, authentication
 * errors, authorization errors, capability errors, and execution errors,
 * never collapsing everything into a bare HTTP 500 or a generic
 * "something went wrong."
 *
 * This module does NOT reimplement Phase 1's GatewayError, Phase 3's
 * CapabilityError, or Phase 4's ExecutionError — it maps them into the
 * MCP tool-call error shape the SDK expects (a CallToolResult with
 * isError: true and a safe text content block), or into a JSON-RPC error
 * object for protocol-level failures the SDK itself doesn't already
 * handle.
 *
 * Never leaked: stack traces, raw Prisma/SQL errors, Redis internals,
 * filesystem paths, secrets, token contents, payment credentials.
 */
import { GatewayError } from "../shared/errors"
import { CapabilityError } from "../capabilities/errors"
import { ExecutionError } from "../execution/contracts/execution-error"

export type McpErrorCategory =
  | "TRANSPORT"
  | "PROTOCOL"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "CAPABILITY"
  | "EXECUTION"
  | "INTERNAL"

export interface McpSafeError {
  category: McpErrorCategory
  code: string
  message: string
}

/**
 * Converts any caught value (from any Phase 1-4 layer, or an unexpected
 * exception) into a safe, categorized error description — never the
 * original object, never a stack trace.
 */
export function toMcpSafeError(err: unknown): McpSafeError {
  if (err instanceof AuthorizationDeniedError) {
    return { category: "AUTHORIZATION", code: err.code, message: err.message }
  }
  if (err instanceof GatewayError) {
    // Phase 1's own error contract already distinguishes AUTH_* codes
    // from everything else — reuse its category split.
    const category: McpErrorCategory = err.code.startsWith("AUTH") || err.code === "SIGNATURE_INVALID" || err.code === "SIGNATURE_EXPIRED" || err.code === "REPLAY_DETECTED" ? "AUTHENTICATION" : "TRANSPORT"
    return { category, code: err.code, message: err.message }
  }
  if (err instanceof CapabilityError) {
    return { category: "CAPABILITY", code: err.code, message: err.message }
  }
  if (err instanceof ExecutionError) {
    // FORBIDDEN from the execution layer is itself an identity/authorization-adjacent
    // outcome (e.g. connection not ACTIVE) — still categorized as EXECUTION here since
    // it originates from the Phase 4 hard-safety-checks layer, not the Phase 5/6
    // authorization hook specifically. The distinction matters for observability
    // (09-security-boundary.md documents this split), not for the caller-facing message.
    return { category: "EXECUTION", code: err.code, message: err.message }
  }
  return { category: "INTERNAL", code: "INTERNAL_ERROR", message: "An internal error occurred." }
}

/**
 * Thrown by the Phase 6 authorization hook (authorizeCapability()) when a
 * capability call is denied. Kept as its own error type (rather than
 * reusing ExecutionError's FORBIDDEN) so this phase's own tests and future
 * Phase 6 work can distinguish "denied by policy" from "denied by a
 * structural execution-layer check" unambiguously.
 */
export class AuthorizationDeniedError extends Error {
  /**
   * Stable machine-readable code. Defaults to "AUTHORIZATION_DENIED"
   * (Phase 5/6 behavior, unchanged). Phase 7's execution gate supplies
   * more specific stable codes (e.g. "APPROVAL_REQUIRED",
   * "APPROVAL_BINDING_MISMATCH") through the same throw-to-deny type, so
   * the MCP layer never needs a second denial error class.
   */
  readonly code: string
  constructor(message: string, code: string = "AUTHORIZATION_DENIED") {
    super(message)
    this.code = code
    this.name = "AuthorizationDeniedError"
  }
}
