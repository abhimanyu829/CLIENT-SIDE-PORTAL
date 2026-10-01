/**
 * lib/agent-gateway/governance/errors.ts — stable governance error codes.
 */
export type GovernanceErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "VALIDATION_FAILED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "UNAVAILABLE"

const STATUS: Record<GovernanceErrorCode, number> = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
  VALIDATION_FAILED: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  UNAVAILABLE: 503,
}

export class GovernanceError extends Error {
  readonly statusCode: number
  constructor(readonly code: GovernanceErrorCode, message: string) {
    super(message)
    this.name = "GovernanceError"
    this.statusCode = STATUS[code]
  }
}

export const notFound = (what: string) => new GovernanceError("NOT_FOUND", `${what} not found.`)
export const conflict = (what: string) => new GovernanceError("CONFLICT", `The ${what} was changed by someone else. Reload and try again.`)
