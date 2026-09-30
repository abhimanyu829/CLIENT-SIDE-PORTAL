/**
 * lib/agent-gateway/shared/types.ts
 *
 * Phase 1 request-context and extension-point contracts, extended in
 * Phase 2 with the resolved machine-identity shape. Fields required only
 * by Phase 3+ (capabilities, policy) remain optional/undefined here —
 * Phase 2 must not fabricate values for them.
 */

export type GatewayAuthMethod = "BEARER" | "SIGNED_REQUEST"

/**
 * Internal-only granular denial reason. Used for logging/audit and for the
 * gateway's OWN internal decision-making — never sent verbatim to an
 * external caller as-is (see toExternalAuthFailureCode in
 * auth/error-mapping.ts, which collapses these to a small external set so
 * a caller cannot enumerate connection existence/state via error probing,
 * per spec §39).
 */
export type InternalAuthFailureCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "AUTH_EXPIRED"
  | "CONNECTION_INACTIVE"
  | "CONNECTION_NOT_FOUND"
  | "CONNECTION_PENDING"
  | "CONNECTION_SUSPENDED"
  | "CONNECTION_REVOKED"
  | "CONNECTION_EXPIRED"
  | "CREDENTIAL_EXPIRED"
  | "CREDENTIAL_REVOKED"
  | "ENVIRONMENT_MISMATCH"

/**
 * Normalized outcome of authenticating one request. `authenticated: false`
 * means deny — the pipeline never proceeds past authentication in that case.
 */
export interface AuthenticationResult {
  authenticated: boolean

  /** Present only when authenticated: false. Internal-granularity only. */
  failureCode?: InternalAuthFailureCode

  connectionId?: string
  agentId?: string
  ownerId?: string
  teamId?: string
  credentialId?: string
  connectionStatus?: AgentConnectionStatusValue

  authMethod?: GatewayAuthMethod
  tokenId?: string
  scopes?: string[]
}

export type AgentConnectionStatusValue = "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED"

/**
 * The resolved MACHINE identity for one authenticated request — never a
 * human user, admin account, or AI agent itself. Every field traces back
 * to a verified AgentConnection/AgentCredential row, resolved server-side
 * (lib/agent-gateway/identity/connection-service.ts), never from a
 * client-supplied header.
 */
export interface AgentMachineIdentity {
  agentId?: string
  connectionId: string
  credentialId: string
  ownerId: string
  teamId?: string | null
  provider?: string
  externalAgentId?: string | null
  connectionStatus: AgentConnectionStatusValue
  authenticatedAt: Date
}

/**
 * Normalized, trusted request context built ONLY from verified credentials
 * and trusted server-side resolution. Never populated from client-supplied
 * identity headers (X-Agent-Id, X-Owner-Id, etc.) — see auth/token-parser.ts.
 */
export interface AgentGatewayRequestContext {
  requestId: string
  receivedAt: Date

  authenticated: boolean

  /** Phase 2: the fully-resolved machine identity, when authenticated. */
  machine?: AgentMachineIdentity

  // Flattened convenience accessors mirroring `machine`'s fields — kept for
  // Phase 1 call-site compatibility (rate-limit key derivation, logging).
  // Always derived FROM `machine`, never set independently.
  connectionId?: string
  agentId?: string
  ownerId?: string
  teamId?: string

  authMethod?: GatewayAuthMethod
  tokenId?: string

  clientIp?: string
  userAgent?: string

  /** Reserved for Phase 5 (MCP). Phase 1/2 only ever produce "HTTP". */
  protocol: "HTTP" | "MCP"

  /** Reserved for Phase 3+ (AgentPolicy). Always undefined in Phase 2. */
  policyVersion?: number

  signal: AbortSignal
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
}

export interface SignatureVerificationResult {
  valid: boolean
  failureCode?: "SIGNATURE_INVALID" | "SIGNATURE_EXPIRED" | "REPLAY_DETECTED"
}

export interface GatewayAuditEvent {
  requestId: string
  timestamp: Date
  component: string
  outcome: "SUCCESS" | "DENIED" | "ERROR"
  connectionId?: string
  agentId?: string
  route?: string
  statusCode?: number
  errorCode?: string
  latencyMs?: number
}

// ── Type-safe extension points (Phase 1 defines the shape; later phases implement more) ──

export interface GatewayAuthenticator {
  authenticate(request: Request): Promise<AuthenticationResult>
}

export interface GatewayRateLimiter {
  check(key: string, cost?: number): Promise<RateLimitResult>
}

export interface GatewaySignatureVerifier {
  verify(request: Request, rawBody: string): Promise<SignatureVerificationResult>
}

export interface GatewayRouter {
  route(context: AgentGatewayRequestContext, request: Request): Promise<Response>
}

export interface GatewayAuditHook {
  record(event: GatewayAuditEvent): Promise<void>
}
