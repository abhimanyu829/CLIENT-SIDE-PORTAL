/**
 * lib/agent-gateway/approvals/state-machine.ts
 *
 * The approval lifecycle. Mirrors the Phase 2 connection state machine's
 * shape (identity/state-machine.ts): an explicit legal-transition table and
 * an assertion helper. The table is the specification; the service layer
 * additionally enforces every transition ATOMICALLY with a conditional
 * update (`WHERE status = <from>`), so two concurrent writers can never both
 * move the same request out of the same state.
 *
 *   PENDING  -> APPROVED | REJECTED | EXPIRED | CANCELLED
 *   APPROVED -> CONSUMED | EXPIRED | CANCELLED
 *   CONSUMED, REJECTED, EXPIRED, CANCELLED are terminal.
 */
export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "CONSUMED"] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

const LEGAL_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED"],
  APPROVED: ["CONSUMED", "EXPIRED", "CANCELLED"],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
  CONSUMED: [],
}

export const TERMINAL_APPROVAL_STATUSES: readonly ApprovalStatus[] = ["REJECTED", "EXPIRED", "CANCELLED", "CONSUMED"]

export function isLegalApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false
}

export class IllegalApprovalTransitionError extends Error {
  readonly code = "ILLEGAL_APPROVAL_TRANSITION"
  constructor(readonly from: string, readonly to: string) {
    super(`Illegal approval transition ${from} -> ${to}.`)
    this.name = "IllegalApprovalTransitionError"
  }
}

export function assertLegalApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): void {
  if (!isLegalApprovalTransition(from, to)) throw new IllegalApprovalTransitionError(from, to)
}

export function isTerminalApprovalStatus(status: ApprovalStatus): boolean {
  return TERMINAL_APPROVAL_STATUSES.includes(status)
}
