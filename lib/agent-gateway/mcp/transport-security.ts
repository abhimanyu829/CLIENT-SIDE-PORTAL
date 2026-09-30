/**
 * lib/agent-gateway/mcp/transport-security.ts
 *
 * Host/Origin validation for the MCP endpoint, applied BEFORE the request
 * reaches the MCP SDK's transport. The SDK's own `allowedHosts`/
 * `allowedOrigins`/`enableDnsRebindingProtection` constructor options are
 * marked `@deprecated` in its own type declarations ("Use external
 * middleware... instead") — so this phase implements that "external
 * middleware" itself, following the exact trusted-proxy model Phase 1
 * already established in `security/headers.ts`, rather than either (a)
 * using a deprecated SDK feature or (b) inventing a new trust model.
 *
 * Deployment topology (nginx.conf): TLS terminates at nginx, which is the
 * only intended edge in front of this Next.js process. `server_name` is
 * `abhibhideveloper.online` / `www.abhibhideveloper.online`. The Host
 * header this process sees is therefore always one of those two values
 * (or the request never should have reached the app at all) unless the
 * origin allowlist is explicitly widened for e.g. a staging environment.
 */
import { GatewayError } from "../shared/errors"

function parseAllowedHosts(): string[] {
  const raw = process.env.AGENT_GATEWAY_MCP_ALLOWED_HOSTS
  if (!raw) return []
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

function parseAllowedOrigins(): string[] {
  const raw = process.env.AGENT_GATEWAY_MCP_ALLOWED_ORIGINS
  if (!raw) return []
  return raw
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Validates the Host header against an explicit allowlist, when one is
 * configured. If no allowlist is configured (e.g. local development),
 * validation is skipped — matching the existing gateway's own convention
 * of degrading safely rather than hard-failing when optional config is
 * absent. In production, `AGENT_GATEWAY_MCP_ALLOWED_HOSTS` should always
 * be set (documented in `.env.example` and Phase 5 docs).
 */
export function validateHostHeader(request: Request): void {
  const allowed = parseAllowedHosts()
  if (allowed.length === 0) return

  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0]
  if (!host || !allowed.includes(host)) {
    throw new GatewayError("MALFORMED_REQUEST", "Request Host header is not permitted.")
  }
}

/**
 * Validates the Origin header against an explicit allowlist, ONLY when
 * an Origin header is present at all (server-to-server/machine callers
 * typically never send one — this is a browser-originated-request
 * defense, not a universal requirement). If no allowlist is configured,
 * validation is skipped for the same reason as validateHostHeader.
 */
export function validateOriginHeader(request: Request): void {
  const origin = request.headers.get("origin")
  if (!origin) return // no Origin header at all — not a browser-context request, nothing to validate

  const allowed = parseAllowedOrigins()
  if (allowed.length === 0) return

  if (!allowed.includes(origin.toLowerCase())) {
    throw new GatewayError("MALFORMED_REQUEST", "Request Origin header is not permitted.")
  }
}
