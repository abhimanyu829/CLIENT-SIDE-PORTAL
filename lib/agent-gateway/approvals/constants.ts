/**
 * lib/agent-gateway/approvals/constants.ts
 *
 * Shared approval vocabulary. Kept separate from decision-service.ts so the
 * agent-reachable execution gate never imports the human decision module
 * (asserted structurally by p7-cua-boundary.test.ts).
 */

/** The only human role authorized to approve agent operations in Phase 7. */
export const APPROVER_SCOPE_SUPER_ADMIN = "SUPER_ADMIN"

/** Human Clerk session + out-of-band SMS step-up code (see decision-service.ts). */
export const APPROVAL_METHOD_STEP_UP = "HUMAN_SESSION_PLUS_SMS_STEP_UP"
