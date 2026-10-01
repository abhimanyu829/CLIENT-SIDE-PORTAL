/**
 * lib/agent-gateway/governance/http.ts
 *
 * Request parsing and response mapping shared by the governance routes.
 *
 * - Bodies must be `application/json` (415 otherwise). Besides being the
 *   only format the routes accept, this blocks the "simple request" shape a
 *   cross-site form post would need: a cross-origin JSON POST requires a
 *   CORS preflight, which these routes never grant.
 * - Bodies are size-bounded and validated with strict zod schemas.
 * - Responses use the existing admin shape `{ success, ... }` /
 *   `{ success: false, code, error }`, `Cache-Control: no-store`.
 * - Errors expose a stable code and a generic message only. Next.js
 *   redirect / notFound control flow (requireSuperAdmin) is re-thrown.
 */
import { NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"
import type { z } from "zod"
import { ApprovalError } from "../approvals/errors"
import { GatewayError } from "../shared/errors"
import { TriggerError } from "../triggers/errors"
import { TaskError } from "../tasks/errors"
import { PolicyConflictError } from "../authorization/policy-store"
import { AutonomyConflictError } from "../autonomy/policy-store"
import { GovernanceError } from "./errors"

export const MAX_BODY_BYTES = 32_768

const NO_STORE = { "Cache-Control": "no-store" }

const TASK_STATUS: Partial<Record<string, number>> = {
  TASK_NOT_FOUND: 404,
  TASK_ALREADY_COMPLETED: 409,
  TASK_CANCELLED: 409,
  TASK_EXPIRED: 409,
  TASK_TIMEOUT: 409,
  TASK_ALREADY_RUNNING: 409,
  QUEUE_UNAVAILABLE: 503,
  TASK_STORE_UNAVAILABLE: 503,
}

export async function readJsonBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (type !== "application/json") throw new GovernanceError("UNSUPPORTED_MEDIA_TYPE", "Send the request as application/json.")
  const declared = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new GovernanceError("PAYLOAD_TOO_LARGE", "The request body is too large.")
  const text = await req.text()
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new GovernanceError("PAYLOAD_TOO_LARGE", "The request body is too large.")
  let raw: unknown
  try {
    raw = text.length === 0 ? {} : JSON.parse(text)
  } catch {
    throw new GovernanceError("VALIDATION_FAILED", "The request body is not valid JSON.")
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new GovernanceError("VALIDATION_FAILED", issue ? `Invalid request (${issue.path.join(".") || "body"}: ${issue.message}).` : "Invalid request.")
  }
  return parsed.data
}

export function governanceOk(data: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status, headers: NO_STORE })
}

function fail(status: number, code: string, error: string): NextResponse {
  return NextResponse.json({ success: false, code, error }, { status, headers: NO_STORE })
}

export function governanceErrorResponse(err: unknown): NextResponse {
  unstable_rethrow(err)
  if (err instanceof GovernanceError) return fail(err.statusCode, err.code, err.message)
  // One optimistic-concurrency code across governance (Phase 9 names it TRIGGER_CONFLICT).
  if (err instanceof TriggerError) return fail(err.statusCode, err.code === "TRIGGER_CONFLICT" ? "CONFLICT" : err.code, err.message)
  if (err instanceof PolicyConflictError || err instanceof AutonomyConflictError) return fail(409, "CONFLICT", err.message)
  if (err instanceof TaskError) return fail(TASK_STATUS[err.code] ?? 400, err.code, err.message)
  if (err instanceof ApprovalError) return fail(err.statusCode, err.code, err.message)
  if (err instanceof GatewayError) {
    if (err.code === "CONNECTION_NOT_FOUND") return fail(404, "NOT_FOUND", "Connection not found.")
    return fail(err.statusCode, err.code, err.message)
  }
  return fail(500, "INTERNAL_ERROR", "The request could not be completed.")
}
