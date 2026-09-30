/**
 * lib/agent-gateway/mcp/index.ts
 *
 * Public re-exports for the Phase 5 MCP module, mirroring the
 * export-surface convention already used by Phase 3's
 * `capabilities/index.ts` and Phase 4's `execution/index.ts`.
 */
export { handleMcpRequest } from "./route-handler"
export { createMcpServerForRequest } from "./server"
export { projectTools, resolveProjectedTool, toolNameFor } from "./tool-projection"
export type { ProjectedTool } from "./tool-projection"
export { FailClosedAuthorizer, AllowAllForTestingAuthorizer } from "./authorization-hook"
export type { CapabilityAuthorizer, ResourceContext } from "./authorization-hook"
export { toMcpSafeError, AuthorizationDeniedError } from "./errors"
export type { McpErrorCategory, McpSafeError } from "./errors"
export { buildAuthInfoExtra, extractTrustedIdentity } from "./identity-context"
export type { McpTrustedIdentityExtra } from "./identity-context"
export { validateHostHeader, validateOriginHeader } from "./transport-security"
export { getMcpConfig, __resetMcpConfigForTests } from "./config"
export { recordMcpEvent } from "./observability"
export type { McpEventFields, McpEventKind } from "./observability"
