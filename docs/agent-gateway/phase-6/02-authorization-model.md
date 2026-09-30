# Phase 6 — Authorization Model (Context, Decision, Policy)

## AuthorizationContext

Everything the engine needs to decide, and nothing more (`authorization/types.ts`):

```ts
interface AuthorizationContext {
  requestId: string
  connectionId: string
  agentId?: string
  ownerId: string
  teamId?: string | null
  connectionStatus: AgentConnectionStatusValue

  environment: string

  capabilityId: string
  capabilityVersion: number
  capabilityRiskTier: RiskTier
  capabilityResourceType?: string

  resourceId?: string             // best-effort, matching-only — see 03-resource-scope-boundary.md
  existingPermission?: string | null
  authenticationStrength: "BEARER" | "SIGNED_REQUEST"

  timestamp: Date
}
```

Every identity field (`connectionId`, `ownerId`, `teamId`, `agentId`, `connectionStatus`, `environment`) is copied verbatim from Phase 4's `AgentExecutionContext` — itself built exclusively from Phase 2's verified `AgentMachineIdentity` (`execution/resolver/build-execution-context.ts`). `capabilityId`/`capabilityVersion`/`capabilityRiskTier`/`capabilityResourceType`/`existingPermission` come from Phase 3's `CapabilityDefinition` — the server-resolved object Phase 5 already looked up, never a client-supplied capability name string re-resolved inside this module. `resourceId` is the one field this module itself computes (see `context-builder.ts`), and it is explicitly documented as match-only, never an ownership proof.

## AuthorizationDecision

```ts
type AuthorizationDecisionKind = "ALLOW" | "DENY" | "REQUIRES_APPROVAL" | "POLICY_UNAVAILABLE"

interface AuthorizationDecision {
  decision: AuthorizationDecisionKind
  reasonCode: AuthorizationReasonCode
  message: string
  matchedPolicyId?: string
  matchedPolicyVersionId?: string
  matchedPolicyVersion?: number
  evaluationDurationMs?: number
}
```

Four decisions, exactly as the spec requires. `POLICY_UNAVAILABLE` is a distinct internal reason code (so an operator can distinguish "a policy explicitly denied this" from "the policy subsystem itself failed" in logs) but is enforced **identically to `DENY`** at the `authorizer.ts` boundary — there is no code path anywhere that treats `POLICY_UNAVAILABLE` as anything other than a failure to authorize. `REQUIRES_APPROVAL` is likewise enforced as a deny today, since Phase 7 (the actual approval executor) does not exist yet — see `07-authorization-boundary.md`.

## Reason codes

The spec's own list, plus a small number of internal precedence-stage codes:

`IDENTITY_INVALID`, `CONNECTION_SUSPENDED`, `CONNECTION_REVOKED`, `CONNECTION_EXPIRED`, `CAPABILITY_NOT_ALLOWED`, `CAPABILITY_UNKNOWN`, `CAPABILITY_DISABLED`, `RESOURCE_OUT_OF_SCOPE`, `ENVIRONMENT_MISMATCH`, `RISK_TIER_EXCEEDED`, `POLICY_ALLOW`, `POLICY_DENY`, `APPROVAL_REQUIRED`, `POLICY_UNAVAILABLE`, `DEFAULT_DENY_NO_POLICY`, `HARD_SECURITY_DENY`.

These are internal-only (see `11-error-model.md` for what actually crosses the trust boundary to an external caller — never these codes verbatim, never a policy name).

## Policy model

Two Prisma models, mirroring `AgentConnection`/`AgentCredential`'s "parent + immutable-versioned-child" idiom exactly:

- **`AgentPolicy`** — the stable identity: `id`, `name`, `description?`, `enabled`, `priority`, `createdById`, `currentVersionId?` (points at the live version).
- **`AgentPolicyVersion`** — an immutable rule snapshot: `id`, `policyId`, `version` (monotonic, unique per policy), `status` (`ACTIVE`/`DISABLED`/`SUPERSEDED`), `effect` (`ALLOW`/`DENY`/`REQUIRES_APPROVAL`), `scope` (one of 8 levels), `scopeValue?`, `capabilityId?`, `conditions?` (a `ConditionNode` JSON tree), `riskConstraint?` (a `RiskTier` ceiling), `approvalRequirement` (boolean, independent of `effect`), `note?`.

`ResolvedPolicyVersion` (`types.ts`) is the flattened, engine-facing shape `policy-store.ts` produces by joining a version row with its parent policy's `name`/`enabled`/`priority` — decoupling `engine.ts` from any Prisma-specific type.

## Scope levels

`GLOBAL` (matches everything) → `ENVIRONMENT` → `OWNER` → `TEAM` → `RESOURCE_TYPE` → `CAPABILITY` → `CONNECTION` → `RESOURCE` (narrowest). A version's `capabilityId` field applies as an *additional*, independent filter on top of whatever scope it declares — a `TEAM`-scoped version with a `capabilityId` set only ever matches that one capability for that one team, never "any capability for that team" (per the spec's "never infer permission merely because another capability in the same domain is allowed").

See `04-precedence.md` for how conflicts between scopes/effects resolve deterministically.
