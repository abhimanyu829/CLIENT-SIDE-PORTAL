/**
 * lib/agent-gateway/triggers/errors.ts
 */
import type { TriggerErrorCode } from "./types"

const STATUS_BY_CODE: Record<TriggerErrorCode, number> = {
  TRIGGER_NOT_FOUND: 404,
  TRIGGER_VALIDATION_FAILED: 400,
  TRIGGER_CONFLICT: 409,
  TRIGGER_INVALID_TRANSITION: 409,
  TRIGGERS_UNAVAILABLE: 503,
  SIGNATURE_INVALID: 401,
  REPLAY_DETECTED: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INVALID_REQUEST: 400,
  SCHEDULE_ERROR: 400,
  CONDITION_ERROR: 400,
  TASK_CREATION_FAILED: 503,
  QUEUE_UNAVAILABLE: 503,
  AUTHORIZATION_DENIED: 403,
  APPROVAL_REQUIRED: 403,
}

export class TriggerError extends Error {
  readonly statusCode: number
  constructor(readonly code: TriggerErrorCode, message: string) {
    super(message)
    this.name = "TriggerError"
    this.statusCode = STATUS_BY_CODE[code]
  }
}
