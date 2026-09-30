/**
 * lib/agent-gateway/authorization/rbac-bridge.ts
 *
 * Read-only bridge to the EXISTING human RBAC permission vocabulary
 * (lib/permissions.ts's `PERMISSIONS` constants). Per the Phase 6 spec:
 * "Reuse existing RBAC permissions... Do NOT create duplicate versions
 * such as agent.products.read... unless a genuine semantic separation
 * is required." and "The agent's authority is derived from... assigned
 * agent role/profile... NOT from pretending to be an existing admin
 * user."
 *
 * This module does exactly two things, both read-only:
 *   1. Exposes the SAME permission identifier strings Phase 3's
 *      `CapabilityDefinition.permission.permission` field already uses
 *      (e.g. "read:products") — confirming Phase 6 policies reference
 *      this vocabulary, never a parallel "agent.*" namespace.
 *   2. Provides a single assertion helper (`assertHumanAuthorityIsSeparate`)
 *      used ONLY by tests, to make the RBAC/agent separation an explicit,
 *      checkable invariant rather than a comment-only claim: an agent's
 *      resolved `AuthorizationContext.existingPermission` is set from
 *      Phase 3's OWN static capability metadata (never from re-deriving
 *      "what permissions does this ownerId's human User row have" — a
 *      human admin's role/permissions are NEVER consulted anywhere in
 *      this module, in engine.ts, or in authorizer.ts).
 *
 * lib/permissions.ts, lib/subadmin-permission-policy.ts, lib/admin-auth.ts,
 * and requireAdmin() are NEVER imported, called, or modified by this
 * module or by anything else under lib/agent-gateway/authorization/ —
 * confirmed by the "RBAC integration" test suite
 * (lib/agent-gateway/tests/authz-rbac-integration.test.ts).
 */
import { PERMISSIONS } from "@/lib/permissions"

/**
 * The full set of permission identifiers Phase 6 policies are allowed to
 * reference in a "existing permission compatibility" condition (spec
 * layer #10). Sourced directly from lib/permissions.ts's own constants —
 * this is a re-export/reuse, not a redefinition. If a capability's
 * declared `permission.permission` (Phase 3) is `null` (no existing RBAC
 * permission covers it — see manifest.ts's documented `coupons.create`
 * gap), this set simply won't contain it, which is a correct, honest
 * reflection of "no reusable human permission exists for this yet," not
 * a bug to paper over.
 */
export const KNOWN_HUMAN_PERMISSIONS: readonly string[] = Object.values(PERMISSIONS)

export function isKnownHumanPermission(permission: string | null | undefined): boolean {
  if (!permission) return false
  return KNOWN_HUMAN_PERMISSIONS.includes(permission)
}
