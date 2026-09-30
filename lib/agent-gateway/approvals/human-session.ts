/**
 * lib/agent-gateway/approvals/human-session.ts
 *
 * Resolves the HUMAN approver for the admin approval routes, reusing the
 * EXISTING human auth stack only (Clerk session -> lib/admin-auth.ts
 * requireSuperAdmin(), which re-reads the role from the DB). No second
 * identity system.
 *
 * Anti-self-approval: a request that carries an Agent Gateway machine
 * credential is refused outright — agent credentials are never accepted as
 * human approval, even if a human session cookie is also present.
 */
import { auth as clerkAuth } from "@clerk/nextjs/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { ApprovalError } from "./errors"
import { SIGNATURE_HEADERS } from "../auth/signature-verifier"
import type { HumanApprover } from "./decision-service"

/** True if the request presents any Agent Gateway machine credential. */
export function carriesAgentCredential(req: Request): boolean {
  const authorization = req.headers.get("authorization") ?? ""
  if (/^bearer\s+agw_/i.test(authorization.trim())) return true
  // Phase 1 signed-request credentials (lib/agent-gateway/auth/signature-verifier.ts).
  return Object.values(SIGNATURE_HEADERS).some((name) => req.headers.has(name))
}

export async function requireHumanApprover(req: Request): Promise<HumanApprover> {
  if (carriesAgentCredential(req)) {
    throw new ApprovalError("HUMAN_APPROVAL_INVALID", "Agent credentials cannot be used to decide approvals.")
  }
  const admin = await requireSuperAdmin()
  const clerk = await clerkAuth().catch(() => null)
  const sessionReference = clerk?.sessionId ?? null
  if (!sessionReference || clerk?.userId == null) {
    throw new ApprovalError("HUMAN_APPROVAL_INVALID", "A verified human session is required.")
  }
  return { userId: admin.userId, role: admin.role, sessionReference }
}
