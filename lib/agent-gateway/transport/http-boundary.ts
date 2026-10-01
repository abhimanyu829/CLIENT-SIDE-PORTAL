/**
 * lib/agent-gateway/transport/http-boundary.ts
 *
 * The gateway request pipeline. Implements the 18-step sequence from the
 * Phase 1 spec §25:
 *
 *   1. HTTPS termination           -> handled by nginx (outside this module)
 *   2. TLS validation               -> handled by nginx
 *   3. Gateway receives request     -> handleGatewayRequest() entry
 *   4. Generate request ID          -> generateRequestId()
 *   5. Validate method/path/size    -> security/request-validation.ts
 *   6. Parse authentication         -> auth/token-parser.ts (inside authenticator)
 *   7. Verify credential/signature  -> auth/composite-authenticator.ts
 *   8. Resolve machine identity     -> identity/request-identity.ts
 *   9. Verify connection status     -> credential-store.ts (status check, inside authenticators)
 *  10. Verify timestamp/nonce       -> auth/replay-protection.ts (inside signed-request-authenticator)
 *  11. Apply rate limit             -> limits/rate-limiter.ts
 *  12. Construct request context    -> identity/request-identity.ts
 *  13. Route to approved destination -> routing/backend-router.ts
 *  14-15. Existing backend runs     -> (Phase 3+, not reached in Phase 1 — router returns NOT_FOUND)
 *  16. Sanitize external response   -> toErrorBody() / this module's response construction
 *  17. Log outcome                  -> observability/request-log.ts + audit-hook.ts
 *  18. Return result                -> this module's return
 *
 * This module is transport-agnostic Fetch API (Request/Response) so it
 * can be mounted from a Next.js Route Handler today and, unchanged,
 * behind whatever Phase 5's MCP Streamable HTTP transport needs (a
 * single POST endpoint returning JSON or an SSE stream) — Phase 1 does
 * NOT implement MCP itself, but this boundary's shape is deliberately
 * compatible with it.
 */
import { GatewayError, toErrorBody, toGatewayError } from "../shared/errors"
import {
  validateMethod,
  validateContentType,
  validateDeclaredContentLength,
  validateBodySize,
} from "../security/request-validation"
import { applyGatewayResponseHeaders } from "../security/headers"
import { CompositeAuthenticator } from "../auth/composite-authenticator"
import { toExternalAuthErrorCode } from "../auth/error-mapping"
import { buildRequestContext, rateLimitKeyFor } from "../identity/request-identity"
import { GatewayRedisRateLimiter } from "../limits/rate-limiter"
import { ApprovedDestinationRouter } from "../routing/backend-router"
import { getGatewayConfig } from "../config"
import { generateRequestId } from "../shared/crypto"
import { logGatewayDenial, logGatewayError, logGatewayRequest } from "../observability/request-log"
import { incrementMetric } from "../observability/metrics"
import { getAuditHook } from "../observability/audit-hook"
import { countRequest, recordAuthenticationFailure, recordAuthenticationSuccess, withRequestTrace } from "../observability/request-evidence"

const authenticator = new CompositeAuthenticator()
const rateLimiter = new GatewayRedisRateLimiter()
const router = new ApprovedDestinationRouter()

function jsonResponse(body: unknown, status: number): Response {
  const headers = new Headers({ "content-type": "application/json" })
  applyGatewayResponseHeaders(headers)
  return new Response(JSON.stringify(body), { status, headers })
}

/**
 * Single entry point for all gateway traffic. Never throws — every path
 * resolves to a Response, and every error is converted to the stable
 * GatewayError contract before being serialized.
 */
export async function handleGatewayRequest(request: Request): Promise<Response> {
  const requestId = generateRequestId()
  // Phase 11: one trace scope + agent.request span per request.
  return withRequestTrace("HTTP", requestId, () => processGatewayRequest(request, requestId))
}

async function processGatewayRequest(request: Request, requestId: string): Promise<Response> {
  const startedAt = Date.now()
  const controller = new AbortController()
  incrementMetric("gateway_requests_total")

  try {
    const cfg = getGatewayConfig()
    if (!cfg.AGENT_GATEWAY_ENABLED) {
      throw new GatewayError("GATEWAY_DISABLED", "The Agent Gateway is not enabled.")
    }

    // Step 5: cheap, pre-auth structural validation.
    validateMethod(request)
    validateContentType(request)
    validateDeclaredContentLength(request)

    // Buffer the body once (needed for signature verification AND size
    // re-validation); every downstream consumer reads from this buffered
    // string, never re-reading the original stream.
    const rawBody = request.method === "GET" ? "" : await request.clone().text()
    validateBodySize(rawBody)

    // Steps 6-10: authentication (bearer or signed), including nonce/replay
    // and connection-status checks, all inside the authenticator.
    const authResult = await authenticator.authenticate(request)

    if (!authResult.authenticated) {
      incrementMetric("gateway_auth_failure_total")
      const internalCode = authResult.failureCode ?? "AUTH_INVALID"
      // The EXTERNAL response is always collapsed to a small, non-
      // enumerable set (see auth/error-mapping.ts) — the granular reason
      // (e.g. CONNECTION_SUSPENDED vs. AUTH_INVALID) is recorded in the
      // audit event ONLY, never in the HTTP response body.
      const externalCode = toExternalAuthErrorCode(internalCode)
      const err = new GatewayError(externalCode, "Authentication failed.")
      await getAuditHook().record({
        requestId,
        timestamp: new Date(),
        component: "auth",
        outcome: "DENIED",
        errorCode: internalCode, // internal granularity — audit only
        statusCode: err.statusCode,
      })
      logGatewayDenial({ requestId, errorCode: internalCode }, "agent_gateway_auth_denied")
      recordAuthenticationFailure("HTTP", requestId, internalCode)
      return jsonResponse(toErrorBody(err, requestId), err.statusCode)
    }
    incrementMetric("gateway_auth_success_total")

    // Steps 8/12: construct the trusted request context. Phase 11: the
    // context carries THIS pipeline's requestId, so every downstream event
    // correlates with the id returned in error bodies.
    const context = buildRequestContext(request, authResult, controller.signal, requestId)
    if (context.machine) recordAuthenticationSuccess("HTTP", requestId, context.machine)

    // Best-effort last-seen/last-authenticated metadata update. Never
    // blocks or affects the outcome of this already-successful request.
    if (context.machine) {
      const { getAgentConnectionService } = await import("../identity/connection-service")
      void getAgentConnectionService().recordAuthenticationSuccess(context.machine.connectionId, context.machine.credentialId)
    }
    // Since Phase 11 the pipeline requestId and context.requestId are the same id.

    // Step 11: rate limit, keyed by connectionId now that identity is known.
    const rateLimitResult = await rateLimiter.check(rateLimitKeyFor(context))
    if (!rateLimitResult.allowed) {
      incrementMetric("gateway_rate_limited_total")
      const err = new GatewayError("RATE_LIMITED", "Rate limit exceeded.")
      await getAuditHook().record({
        requestId,
        timestamp: new Date(),
        component: "rate-limit",
        outcome: "DENIED",
        connectionId: context.connectionId,
        agentId: context.agentId,
        errorCode: err.code,
        statusCode: err.statusCode,
      })
      logGatewayDenial(
        { requestId, connectionId: context.connectionId, errorCode: err.code },
        "agent_gateway_rate_limited"
      )
      countRequest("HTTP", "DENIED")
      return jsonResponse(toErrorBody(err, requestId), err.statusCode)
    }

    // Step 13: route to an approved internal destination only. In Phase 1
    // there are none registered — this always resolves to NOT_FOUND, which
    // is the correct, expected outcome (see routing/backend-router.ts).
    const response = await router.route(context, request)

    await getAuditHook().record({
      requestId,
      timestamp: new Date(),
      component: "routing",
      outcome: "SUCCESS",
      connectionId: context.connectionId,
      agentId: context.agentId,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
    })
    logGatewayRequest(
      { requestId, connectionId: context.connectionId, authMethod: context.authMethod, statusCode: response.status, latencyMs: Date.now() - startedAt },
      "agent_gateway_request_completed"
    )
    countRequest("HTTP", "SUCCESS")
    return response
  } catch (rawErr) {
    const err = toGatewayError(rawErr)
    countRequest("HTTP", err.code === "INTERNAL_GATEWAY_ERROR" ? "ERROR" : "DENIED")
    if (err.code === "SIGNATURE_INVALID" || err.code === "SIGNATURE_EXPIRED") {
      incrementMetric("gateway_signature_failure_total")
    }
    if (err.code === "REQUEST_TOO_LARGE") {
      incrementMetric("gateway_request_body_rejections_total")
    }
    await getAuditHook().record({
      requestId,
      timestamp: new Date(),
      component: "pipeline",
      outcome: err.code === "INTERNAL_GATEWAY_ERROR" ? "ERROR" : "DENIED",
      errorCode: err.code,
      statusCode: err.statusCode,
      latencyMs: Date.now() - startedAt,
    })
    logGatewayError({ requestId, errorCode: err.code, err: err.code === "INTERNAL_GATEWAY_ERROR" ? rawErr : undefined }, "agent_gateway_request_failed")
    return jsonResponse(toErrorBody(err, requestId), err.statusCode)
  }
}
