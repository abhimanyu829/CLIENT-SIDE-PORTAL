/**
 * lib/agent-gateway/tests/p7-helpers.ts
 *
 * Shared fixtures for the Phase 7 test suite (p7-*.test.ts).
 */
import { CORE_CAPABILITY_MANIFEST } from "../capabilities/manifest"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AuthorizationDecision } from "../authorization/types"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { EffectiveAutonomyPolicy } from "../autonomy/types"

export function cap(id: string, overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  const base = CORE_CAPABILITY_MANIFEST.find((c) => c.id === id)
  if (!base) throw new Error(`unknown capability ${id}`)
  return { ...base, ...overrides }
}

/** An agent-available capability of the given tier (derived from a real manifest entry). */
export function tierCap(tier: CapabilityDefinition["operationType"], overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  switch (tier) {
    case "READ":
      return cap("products.get", overrides)
    case "LOW_RISK_WRITE":
      return cap("coupons.create", overrides)
    case "HIGH_RISK_MUTATION":
      return cap("products.updatePricing", { exposure: "AGENT_AVAILABLE", ...overrides })
    case "CRITICAL":
      return cap("refunds.process", { exposure: "AGENT_AVAILABLE", ...overrides })
  }
}

export const ALLOW: AuthorizationDecision = {
  decision: "ALLOW",
  reasonCode: "POLICY_ALLOW",
  message: "allowed",
  matchedPolicyId: "pol_1",
  matchedPolicyVersionId: "polver_1",
  matchedPolicyVersion: 1,
}
export const DENY: AuthorizationDecision = { decision: "DENY", reasonCode: "POLICY_DENY", message: "denied" }
export const REQUIRES_APPROVAL: AuthorizationDecision = {
  decision: "REQUIRES_APPROVAL",
  reasonCode: "APPROVAL_REQUIRED",
  message: "needs approval",
  matchedPolicyVersionId: "polver_2",
  matchedPolicyVersion: 1,
}
export const UNAVAILABLE: AuthorizationDecision = { decision: "POLICY_UNAVAILABLE", reasonCode: "POLICY_UNAVAILABLE", message: "down" }

export function policy(overrides: Partial<EffectiveAutonomyPolicy> = {}): EffectiveAutonomyPolicy {
  return {
    id: "aut_1",
    connectionId: "conn_1",
    version: 1,
    status: "ACTIVE",
    autonomyLevel: "LIMITED_AUTONOMY",
    maxRiskTier: "CRITICAL",
    allowedCapabilityIds: [],
    approvalRequiredFor: [],
    environmentScope: [],
    resourceScopeReference: null,
    expiresAt: null,
    ...overrides,
  }
}

export function execCtx(overrides: Partial<AgentExecutionContext> = {}): AgentExecutionContext {
  return {
    requestId: "req_1",
    connectionId: "conn_1",
    agentId: "agent_1",
    ownerId: "owner_1",
    teamId: null,
    connectionStatus: "ACTIVE",
    capabilityId: "x",
    capabilityVersion: 1,
    environment: "development",
    timestamp: new Date(),
    signal: new AbortController().signal,
    tracing: { requestId: "req_1", connectionId: "conn_1", capabilityId: "x", capabilityVersion: 1 },
    ...overrides,
  }
}

/** Extracts the stable "CODE" prefix from a gate/MCP error message or result text. */
export function codeOf(text: string): string {
  return text.split(":")[0]
}
