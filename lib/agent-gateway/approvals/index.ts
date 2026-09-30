/**
 * lib/agent-gateway/approvals/index.ts — Phase 7 approval engine barrel.
 */
export { canonicalJson, CanonicalizationError } from "./canonical-json"
export { computeInputDigest, computeBindingDigest, activeBindingKey } from "./binding"
export type { OperationBinding } from "./binding"
export {
  APPROVAL_STATUSES,
  TERMINAL_APPROVAL_STATUSES,
  isLegalApprovalTransition,
  assertLegalApprovalTransition,
  isTerminalApprovalStatus,
  IllegalApprovalTransitionError,
} from "./state-machine"
export type { ApprovalStatus } from "./state-machine"
export { approvalTtlMs, isExpired, STEP_UP_TTL_MS } from "./expiration"
export { redactValue, buildDisplaySummary, REDACTED } from "./redaction"
export { ApprovalError } from "./errors"
export type { ApprovalErrorCode } from "./errors"
export {
  findOrCreateApprovalRequest,
  findLiveApprovalByBinding,
  findSiblingApproval,
  findRecentRejection,
  consumeApproval,
  cancelApproval,
  cancelApprovalsForConnection,
  expireApproval,
  generatePublicRef,
} from "./request-service"
export type { ApprovalRequestRow, CreateApprovalRequestInput, ConsumeResult } from "./request-service"
export {
  startApprovalStepUp,
  decideApproval,
  cancelApprovalByHuman,
  APPROVER_SCOPE_SUPER_ADMIN,
  APPROVAL_METHOD_STEP_UP,
} from "./decision-service"
export type { HumanApprover, DecideApprovalInput, StepUpSender } from "./decision-service"
