/**
 * lib/agent-gateway/security/headers.ts
 *
 * Trusted-proxy model for forwarded-header handling (Phase 1 spec §7).
 *
 * The gateway does NOT blindly trust X-Forwarded-For / X-Forwarded-Host /
 * X-Forwarded-Proto / X-Real-IP. This app's existing nginx.conf terminates
 * TLS and is the only intended edge in front of the Next.js process (see
 * docker-compose.yml: nginx -> web). We treat nginx as the trusted proxy
 * and read x-real-ip / the first x-forwarded-for entry, EXACTLY mirroring
 * the precedent already established in proxy.ts — not inventing a new
 * trust model, but also not extending trust beyond what proxy.ts already
 * extends.
 *
 * If this gateway is ever deployed behind a different edge (e.g. directly
 * exposed, or behind a different LB), this function must be revisited —
 * it is not safe to assume forwarded headers are trustworthy without a
 * known, single, trusted hop in front of the process.
 */

export function resolveClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()

  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()

  return "unknown"
}

/**
 * Applies the minimal, safe response headers for gateway responses.
 * Does not duplicate the full CSP/HSTS header set already applied
 * globally by next.config.js — only adds gateway-specific hardening.
 */
export function applyGatewayResponseHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Cache-Control", "no-store")
}
