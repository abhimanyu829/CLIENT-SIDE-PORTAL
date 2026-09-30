/**
 * lib/agent-gateway/routing/backend-router.ts
 *
 * Internal routing boundary (Phase 1 spec §20). The gateway forwards ONLY
 * to explicitly approved internal destinations — never to a client-
 * supplied URL, never a generic `proxy(url)` / `http_request(url)`
 * primitive. This is the architectural guard against SSRF and confused-
 * deputy risk.
 *
 * Phase 1 intentionally registers ZERO destinations. There are no MCP
 * tools, no capability registry, and no business-domain actions in this
 * phase (see Phase 0/1 scope). Every request that reaches routing today
 * gets NOT_FOUND — this is correct and expected, not a bug: it proves the
 * boundary exists and rejects-by-default before any capability is wired
 * in Phase 3+.
 *
 * Phase 3+ integration point: register(name, handler) where `handler`
 * calls into an EXISTING backend service/action (per the Backend Adapter
 * pattern from the architecture spec) — never raw Prisma, never a
 * dynamically-constructed destination.
 */
import type { AgentGatewayRequestContext, GatewayRouter } from "../shared/types"
import { GatewayError } from "../shared/errors"

export type RouteHandler = (context: AgentGatewayRequestContext, request: Request) => Promise<Response>

export class ApprovedDestinationRouter implements GatewayRouter {
  private readonly routes = new Map<string, RouteHandler>()

  /**
   * Registers exactly one approved destination name → handler. Not called
   * anywhere in Phase 1 — reserved for Phase 3+ capability wiring. Kept
   * here (rather than omitted) so the "approved destination table, never
   * arbitrary" shape is established now, not retrofitted later.
   */
  register(name: string, handler: RouteHandler): void {
    if (this.routes.has(name)) {
      throw new Error(`Route "${name}" is already registered.`)
    }
    this.routes.set(name, handler)
  }

  async route(context: AgentGatewayRequestContext, request: Request): Promise<Response> {
    // Phase 1: no destinations exist yet. Every request denies with
    // NOT_FOUND rather than falling through to any default/dynamic target.
    void context
    void request
    throw new GatewayError(
      "NOT_FOUND",
      "No agent capabilities are available yet. The gateway foundation is active but no business capability has been registered."
    )
  }
}
