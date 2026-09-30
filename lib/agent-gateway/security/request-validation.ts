/**
 * lib/agent-gateway/security/request-validation.ts
 *
 * Cheap, pre-auth request validation — reject malformed/oversized/
 * wrong-shaped requests BEFORE any expensive processing (crypto, Redis,
 * credential lookup), per Phase 1 spec §17.
 */
import { GatewayError } from "../shared/errors"
import { getGatewayConfig } from "../config"

const ALLOWED_METHODS = new Set(["GET", "POST"])
const ALLOWED_CONTENT_TYPES = ["application/json"]

export function validateMethod(request: Request): void {
  if (!ALLOWED_METHODS.has(request.method)) {
    throw new GatewayError("MALFORMED_REQUEST", "Unsupported HTTP method.")
  }
}

export function validateContentType(request: Request): void {
  // GET requests never carry a body — content-type is irrelevant for them.
  if (request.method === "GET") return

  const contentType = request.headers.get("content-type") ?? ""
  const base = contentType.split(";")[0].trim().toLowerCase()
  if (!base || !ALLOWED_CONTENT_TYPES.includes(base)) {
    throw new GatewayError("MALFORMED_REQUEST", "Unsupported or missing Content-Type.")
  }
}

/**
 * Validates the declared Content-Length header against the configured max
 * BEFORE reading the body. This is a cheap first check — the actual byte
 * count is re-verified against the real buffered body in
 * validateBodySize(), since Content-Length is client-supplied and not
 * authoritative on its own.
 */
export function validateDeclaredContentLength(request: Request): void {
  const declared = request.headers.get("content-length")
  if (!declared) return // absent is fine — chunked/unknown length, verified after buffering instead
  const bytes = Number(declared)
  const max = getGatewayConfig().AGENT_GATEWAY_MAX_BODY_BYTES
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new GatewayError("MALFORMED_REQUEST", "Invalid Content-Length header.")
  }
  if (bytes > max) {
    throw new GatewayError("REQUEST_TOO_LARGE", "Request body exceeds the maximum allowed size.")
  }
}

/** Authoritative body-size check against the actual buffered body. */
export function validateBodySize(rawBody: string): void {
  const max = getGatewayConfig().AGENT_GATEWAY_MAX_BODY_BYTES
  const bytes = Buffer.byteLength(rawBody, "utf8")
  if (bytes > max) {
    throw new GatewayError("REQUEST_TOO_LARGE", "Request body exceeds the maximum allowed size.")
  }
}

/**
 * Validates that a non-empty body is syntactically valid JSON, when
 * content-type declared JSON. Returns the parsed value so callers don't
 * double-parse. Throws MALFORMED_REQUEST on invalid JSON — never lets a
 * JSON.parse exception's raw message reach the caller.
 */
export function parseJsonBody(rawBody: string): unknown {
  if (!rawBody) return undefined
  try {
    return JSON.parse(rawBody)
  } catch {
    throw new GatewayError("MALFORMED_REQUEST", "Request body is not valid JSON.")
  }
}
