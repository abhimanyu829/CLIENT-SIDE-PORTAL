/**
 * lib/agent-gateway/governance/index.ts — Phase 10 Agent Governance.
 *
 * Server-only building blocks for the SUPER_ADMIN governance area in the
 * existing admin panel (app/(admin)/admin/agent-governance) and its
 * mutation routes (app/api/admin/agent-governance). Everything here reads
 * or changes state through the existing Phase 2–9 services and tables.
 */
export { requireGovernanceViewer, requireGovernanceOperator } from "./access"
export { GovernanceError } from "./errors"
export type { GovernanceErrorCode } from "./errors"
export { governanceErrorResponse, governanceOk, readJsonBody, MAX_BODY_BYTES } from "./http"
export { PAGE_SIZE, MAX_PAGE, parsePage, pageMeta, firstParam, pickEnum, pickId } from "./pagination"
export type { Paged, PageMeta, SearchParams } from "./pagination"
export { GOVERNANCE_AUDIT_ACTIONS, recordGovernanceAudit } from "./audit"
export * from "./queries"
export * from "./views"
export { getRuntimeSnapshot } from "./health"
export type { RuntimeSnapshot, QueueCounts, RuntimeDeps } from "./health"
export * from "./actions"
