/**
 * lib/agent-gateway/governance/access.ts
 *
 * Phase 10 — who may use Agent Governance. Reuses the EXISTING human auth
 * stack only (no new permission, no sub-admin resource):
 *
 *   pages      requireSuperAdmin()   (lib/admin-auth.ts) — SUB_ADMIN, USER,
 *              banned and anonymous users are redirected, whatever
 *              permissions a sub-admin holds;
 *   mutations  requireHumanApprover() (Phase 7) — the same SUPER_ADMIN check
 *              plus a live Clerk session, and any request carrying an Agent
 *              Gateway machine credential is refused, so an agent can never
 *              govern itself.
 *
 * `/admin/agent-governance` and `/api/admin/agent-governance` are
 * deliberately NOT mapped in lib/subadmin-permission-policy.ts, so the admin
 * layout's requireAdmin() denies sub-admins as well (defence in depth).
 */
import { requireSuperAdmin, type AdminSession } from "@/lib/admin-auth"
import { requireHumanApprover } from "../approvals/human-session"
import type { HumanApprover } from "../approvals/decision-service"

export async function requireGovernanceViewer(): Promise<AdminSession> {
  return requireSuperAdmin()
}

export async function requireGovernanceOperator(req: Request): Promise<HumanApprover> {
  return requireHumanApprover(req)
}
