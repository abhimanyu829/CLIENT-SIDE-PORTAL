/**
 * lib/agent-gateway/auth/token-parser.ts
 *
 * Parses the Authorization header only. Deliberately narrow: this module
 * has no knowledge of credential validity, only of header syntax.
 *
 * SECURITY: never trust client-supplied identity headers as proof of
 * anything. X-Agent-Id / X-Connection-Id / X-Owner-Id / X-Team-Id /
 * X-Admin style headers are NOT parsed here and MUST NOT be consulted
 * anywhere in the authentication path — identity comes only from a
 * verified credential (see credential-store.ts + bearer-authenticator.ts).
 */

export interface ParsedBearerToken {
  scheme: "Bearer"
  token: string
}

const BEARER_PREFIX = "Bearer "

/**
 * Returns the parsed bearer token, or null if the header is absent or
 * doesn't match the expected `Bearer <token>` shape. Never throws.
 */
export function parseBearerAuthorizationHeader(request: Request): ParsedBearerToken | null {
  const header = request.headers.get("authorization")
  if (!header) return null
  if (!header.startsWith(BEARER_PREFIX)) return null

  const token = header.slice(BEARER_PREFIX.length).trim()
  // Reject empty, whitespace-only, or implausibly long tokens before any lookup.
  if (!token || token.length < 16 || token.length > 512) return null
  // Reject tokens containing whitespace/control characters (malformed header value).
  if (/\s/.test(token)) return null

  return { scheme: "Bearer", token }
}
