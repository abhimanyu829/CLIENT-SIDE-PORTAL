/**
 * lib/agent-gateway/approvals/http.ts
 *
 * Shared response mapping for the human approval admin routes. Only the
 * stable code and generic message are exposed — never stack traces or DB
 * errors. Next.js redirect/notFound control-flow errors thrown by
 * requireSuperAdmin() are re-thrown untouched.
 */
import { NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"
import { ApprovalError } from "./errors"

export function approvalErrorResponse(err: unknown): NextResponse {
  unstable_rethrow(err)
  if (err instanceof ApprovalError) {
    return NextResponse.json({ success: false, code: err.code, error: err.message }, { status: err.statusCode })
  }
  return NextResponse.json({ success: false, code: "POLICY_UNAVAILABLE", error: "Unable to process the approval request." }, { status: 500 })
}

/** Public approval references are `apr_` + 32 lowercase hex. */
export function isValidPublicRef(ref: string): boolean {
  return /^apr_[0-9a-f]{32}$/.test(ref)
}
