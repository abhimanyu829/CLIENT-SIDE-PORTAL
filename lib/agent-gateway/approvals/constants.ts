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

/**
 * Upper bound on live PENDING approval requests per connection (P14-F3).
 * Every distinct input is a distinct operation and gets its own request, so
 * without a bound an agent could flood the human approvers' queue by
 * varying its input. At the bound the gate refuses with
 * APPROVAL_LIMIT_REACHED and creates nothing. Soft limit: two concurrent
 * requests at the boundary may both pass (at most a few over), which is
 * acceptable for a queue-size control.
 */
export const MAX_PENDING_APPROVALS_PER_CONNECTION = 20
