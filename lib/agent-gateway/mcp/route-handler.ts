/**
 * lib/agent-gateway/mcp/route-handler.ts
 *
 * The single entry point Next.js's Route Handler (`app/api/agent-gateway/mcp/route.ts`)
 * calls. This is the ONLY place the MCP transport is ever constructed and
 * connected — everything before it is Phase 1/2 (transport validation,
 * authentication, rate limiting, identity resolution), and everything
 * after it is Phase 3/4/5's own already-built pipeline (tool projection,
 * authorization hook, adapter execution).
 *
 * Order of operations, matching the spec's required chain exactly:
 *   1. Transport validation (Host/Origin, method, content-type, body size) — Phase 1 + this phase's transport-security.ts
 *   2. Phase 1 Gateway authentication (bearer/signed request)
 *   3. Phase 2 identity resolution (already embedded in the auth result)
 *   4. Rate limiting (Phase 1, keyed by connectionId once authenticated)
 *   5. MCP method validation + tools/list + tools/call — delegated to the SDK + mcp/server.ts
 *   6. Phase 6 authorization hook (inside mcp/server.ts's per-tool callback)
 *   7. Phase 4 adapter execution (inside mcp/server.ts's per-tool callback)
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import { GatewayError, toErrorBody, toGatewayError } from "../shared/errors"
import { validateMethod, validateContentType, validateDeclaredContentLength, validateBodySize } from "../security/request-validation"
import { validateHostHeader, validateOriginHeader } from "./transport-security"
import { applyGatewayResponseHeaders } from "../security/headers"
import { CompositeAuthenticator } from "../auth/composite-authenticator"
import { toExternalAuthErrorCode } from "../auth/error-mapping"
import { buildRequestContext, rateLimitKeyFor } from "../identity/request-identity"
import { GatewayRedisRateLimiter } from "../limits/rate-limiter"
import { getGatewayConfig } from "../config"
import { getMcpConfig } from "./config"
import { generateRequestId } from "../shared/crypto"
import { createMcpServerForRequest } from "./server"
import { visibleCapabilities } from "../rollout/controls"
import { buildAuthInfoExtra } from "./identity-context"
import { getCapabilityRegistry } from "../capabilities"
import { getAdapterRegistry } from "../execution"
import { PolicyEngineAuthorizer } from "../authorization/authorizer"
import { ExecutionGate } from "../execution-gate/gate"
import { getTaskEngineConfig } from "../tasks/config"
import { createAgentTaskService } from "../tasks"
import { recordMcpEvent } from "./observability"
import { getAuditHook } from "../observability/audit-hook"
import { logGatewayDenial, logGatewayError } from "../observability/request-log"
import { incrementMetric } from "../observability/metrics"
import { countRequest, recordAuthenticationFailure, recordAuthenticationSuccess, withRequestTrace } from "../observability/request-evidence"

const authenticator = new CompositeAuthenticator()
const rateLimiter = new GatewayRedisRateLimiter()

function jsonResponse(body: unknown, status: number): Response {
  const headers = new Headers({ "content-type": "application/json" })
  applyGatewayResponseHeaders(headers)
  return new Response(JSON.stringify(body), { status, headers })
}

/**
 * Handles one MCP HTTP request end to end. Never throws — every path
 * resolves to a Response.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const requestId = generateRequestId()
  // Phase 11: one trace scope + agent.request span per request.
  return withRequestTrace("MCP", requestId, () => processMcpRequest(request, requestId))
}

async function processMcpRequest(request: Request, requestId: string): Promise<Response> {
  const controller = new AbortController()
  incrementMetric("gateway_requests_total")

  try {
    const mcpCfg = getMcpConfig()
    if (!mcpCfg.AGENT_GATEWAY_MCP_ENABLED) {
      throw new GatewayError("GATEWAY_DISABLED", "The MCP endpoint is not enabled.")
    }
    const cfg = getGatewayConfig()
    if (!cfg.AGENT_GATEWAY_ENABLED) {
      throw new GatewayError("GATEWAY_DISABLED", "The Agent Gateway is not enabled.")
    }

    // Step 1: transport validation — cheap, pre-auth structural checks,
    // same convention as Phase 1's http-boundary.ts.
    validateHostHeader(request)
    validateOriginHeader(request)
    validateMethod(request)
    validateContentType(request)
    validateDeclaredContentLength(request)

    const rawBody = request.method === "GET" ? "" : await request.clone().text()
    validateBodySize(rawBody)

    // Step 2/3: Phase 1 authentication -> Phase 2 identity resolution.
    const authResult = await authenticator.authenticate(request)
    if (!authResult.authenticated) {
      incrementMetric("gateway_auth_failure_total")
      const internalCode = authResult.failureCode ?? "AUTH_INVALID"
      const externalCode = toExternalAuthErrorCode(internalCode)
      const err = new GatewayError(externalCode, "Authentication failed.")
      await getAuditHook().record({
        requestId,
        timestamp: new Date(),
        component: "mcp-auth",
        outcome: "DENIED",
        errorCode: internalCode,
        statusCode: err.statusCode,
      })
      logGatewayDenial({ requestId, errorCode: internalCode }, "agent_gateway_mcp_auth_denied")
      recordMcpEvent({ event: "authentication_outcome", requestId, outcome: "DENIED", errorCode: internalCode })
      recordAuthenticationFailure("MCP", requestId, internalCode)
      return jsonResponse(toErrorBody(err, requestId), err.statusCode)
    }
    incrementMetric("gateway_auth_success_total")

    // Phase 11: the context carries THIS pipeline's requestId (one id per request).
    const gatewayContext = buildRequestContext(request, authResult, controller.signal, requestId)
    if (!gatewayContext.machine) {
      // Should be unreachable given authResult.authenticated === true, but
      // fail closed explicitly rather than proceed with a partial identity.
      const err = new GatewayError("AUTH_INVALID", "Authentication succeeded but no machine identity could be resolved.")
      return jsonResponse(toErrorBody(err, requestId), err.statusCode)
    }
    recordMcpEvent({ event: "authentication_outcome", requestId, connectionId: gatewayContext.machine.connectionId, outcome: "SUCCESS" })
    recordAuthenticationSuccess("MCP", requestId, gatewayContext.machine)

    // Step 4: rate limiting, keyed by connectionId now that identity is known.
    const rateLimitResult = await rateLimiter.check(rateLimitKeyFor(gatewayContext))
    if (!rateLimitResult.allowed) {
      incrementMetric("gateway_rate_limited_total")
      countRequest("MCP", "DENIED")
      const err = new GatewayError("RATE_LIMITED", "Rate limit exceeded.")
      return jsonResponse(toErrorBody(err, requestId), err.statusCode)
    }

    // Step 5/6/7: MCP protocol handling -> Phase 6 hook -> Phase 4 execution,
    // all inside mcp/server.ts's per-tool callbacks.
    recordMcpEvent({ event: "mcp_request_received", requestId, connectionId: gatewayContext.machine.connectionId })

    const environment = cfg.AGENT_GATEWAY_ENVIRONMENT
    const authInfo: AuthInfo = {
      token: "", // Never the raw credential — already verified upstream; the SDK's AuthInfo.token field is not read anywhere in this module's own logic.
      clientId: gatewayContext.machine.connectionId,
      scopes: [],
      extra: buildAuthInfoExtra(gatewayContext, environment),
    }

    // One gate per request, shared by direct tool calls and async submission
    // (Phase 8), so both run exactly the same authorization/approval chain.
    const gate = new ExecutionGate({ authorization: new PolicyEngineAuthorizer() })
    const server = createMcpServerForRequest(
      {
        capabilityRegistry: getCapabilityRegistry(),
        adapterRegistry: getAdapterRegistry(),
        // Phase 6 — the real authorization/policy engine, replacing
        // Phase 5's FailClosedAuthorizer placeholder. PolicyEngineAuthorizer
        // itself fails closed (denies) on any internal error, so this
        // substitution never weakens the production default — see
        // lib/agent-gateway/authorization/authorizer.ts's fail-closed
        // guarantee and docs/agent-gateway/phase-6/07-authorization-boundary.md.
        //
        // Phase 7 — the ExecutionGate wraps Phase 6 (never replaces it):
        // authorization -> autonomy -> human approval (atomic single-use
        // consumption), re-evaluated on every call immediately before the
        // Phase 4 adapter. Fails closed. See docs/agent-gateway/phase-7/10-execution-gate.md.
        authorizer: gate,
        // Phase 8 — async task tools, opt-in (AGENT_GATEWAY_TASKS_ENABLED).
        taskService: getTaskEngineConfig().enabled ? createAgentTaskService(gate) : undefined,
        // Phase 15 — only capabilities released to this connection are tools (fails closed to none).
        visibleCapabilityIds: await visibleCapabilities(gatewayContext.machine.connectionId, environment, getCapabilityRegistry().list()),
      },
      gatewayContext,
      environment
    )
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless, per architecture decision (see docs/agent-gateway/phase-5/03-transport-and-protocol.md)
      maxRequestBodySize: cfg.AGENT_GATEWAY_MAX_BODY_BYTES,
      // Without this, the transport defaults to an SSE stream response even
      // for a single request/response tool call, which is incompatible
      // with this app's existing request/response pipeline model (the
      // audit hook below records against a known final response.status
      // once handleRequest() resolves; a long-lived SSE stream would never
      // "resolve" in that sense). Every capability in this phase is a fast
      // synchronous adapter call (Phase 4's own docs confirm none are
      // ASYNC) — there is no legitimate need for a streaming response yet,
      // so plain JSON responses are the correct, simpler choice.
      enableJsonResponse: true,
    })

    await server.connect(transport)
    try {
      const response = await transport.handleRequest(request, { authInfo, parsedBody: rawBody ? JSON.parse(rawBody) : undefined })
      await getAuditHook().record({
        requestId,
        timestamp: new Date(),
        component: "mcp",
        outcome: "SUCCESS",
        connectionId: gatewayContext.machine.connectionId,
        statusCode: response.status,
      })
      countRequest("MCP", "SUCCESS")
      return response
    } finally {
      await transport.close()
      await server.close()
    }
  } catch (rawErr) {
    const err = toGatewayError(rawErr)
    countRequest("MCP", err.code === "INTERNAL_GATEWAY_ERROR" ? "ERROR" : "DENIED")
    recordMcpEvent({ event: "protocol_failure", requestId, errorCode: err.code })
    logGatewayError({ requestId, errorCode: err.code, err: err.code === "INTERNAL_GATEWAY_ERROR" ? rawErr : undefined }, "agent_gateway_mcp_request_failed")
    return jsonResponse(toErrorBody(err, requestId), err.statusCode)
  }
}
