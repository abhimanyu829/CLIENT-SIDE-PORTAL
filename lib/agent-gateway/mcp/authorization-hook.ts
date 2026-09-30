/**
 * lib/agent-gateway/mcp/authorization-hook.ts
 *
 * The clean integration boundary for Phase 6's future authorization/
 * policy engine. Phase 5 does NOT implement ABAC, RBAC replacement,
 * approval, autonomy, quotas, or budgets here — only the interface and a
 * safe default implementation.
 *
 * PRODUCTION DEFAULT: fail closed. Every capability call is DENIED unless
 * an authorizer is explicitly configured. This is intentional and
 * required by the spec ("Do NOT default to unrestricted execution simply
 * because Phase 6 does not exist yet"). Phase 5 registers no capabilities
 * as authorized — it only builds the hook Phase 6 will fill in.
 *
 * DEVELOPMENT/TEST: a clearly-named, isolated stub
 * (`AllowAllForTestingAuthorizer`) is available for tests and local
 * development ONLY. It must never be wired in as the production default
 * — see mcp/server.ts, which always constructs `FailClosedAuthorizer`
 * unless a caller explicitly injects a different one (tests only).
 */
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { CapabilityDefinition } from "../capabilities/types"
import { AuthorizationDeniedError } from "./errors"

export interface ResourceContext {
  /** The specific resource identifier the call targets, if any (e.g. a product id extracted from validated input). Informational only in Phase 5 — Phase 6 owns interpreting it. */
  resourceId?: string
}

/**
 * The Phase 6 integration point. `authorize()` must throw
 * `AuthorizationDeniedError` to deny, or resolve normally to allow.
 * Never returns a boolean — an authorizer that can only throw-to-deny
 * cannot be accidentally "allowed" by a caller forgetting to check a
 * return value.
 */
export interface CapabilityAuthorizer {
  authorize(
    context: AgentExecutionContext,
    capability: CapabilityDefinition,
    input: unknown,
    resourceContext: ResourceContext
  ): Promise<void>
}

/**
 * Production default. Denies every call. This is not a placeholder bug —
 * it is the explicit, documented, spec-required behavior until Phase 6
 * exists and is wired in. See docs/agent-gateway/phase-5/07-authorization-boundary.md.
 */
export class FailClosedAuthorizer implements CapabilityAuthorizer {
  async authorize(
    _context: AgentExecutionContext,
    capability: CapabilityDefinition,
    _input: unknown,
    _resourceContext: ResourceContext
  ): Promise<void> {
    throw new AuthorizationDeniedError(
      `Capability "${capability.id}" execution requires an authorization decision, and no authorization subsystem is configured. Failing closed.`
    )
  }
}

/**
 * TEST-ONLY. Never imported by any production code path — only by test
 * files, which construct their own McpToolServer with this injected
 * explicitly. Named unambiguously so it can never be mistaken for a
 * production default in a code review or a grep for "Authorizer".
 */
export class AllowAllForTestingAuthorizer implements CapabilityAuthorizer {
  async authorize(
    _context: AgentExecutionContext,
    _capability: CapabilityDefinition,
    _input: unknown,
    _resourceContext: ResourceContext
  ): Promise<void> {
    // Intentionally permissive — TEST-ONLY, see class doc comment.
  }
}
