# Phase 7 — Data Model

Migration: `prisma/migrations/20261001000000_agent_gateway_phase7_approval_engine/migration.sql` (additive only; hand-written; **not applied** to any database).

## Enums

- `AgentAutonomyLevel`: OBSERVE_ONLY, ASSISTED, APPROVAL_REQUIRED, LIMITED_AUTONOMY, FULL_SCOPED_AUTONOMY
- `AgentAutonomyPolicyStatus`: ACTIVE, SUPERSEDED, DISABLED
- `AgentApprovalStatus`: PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED, CONSUMED
- `AgentApprovalDecisionKind`: APPROVED, REJECTED

## Tables

**AgentAutonomyPolicy** — versioned per connection. Unique `(connectionId, version)`; index `(connectionId, status)`. FK connection (cascade), createdBy User (restrict).

**AgentApprovalRequest** — one row per requested operation. Unique `publicRef`, unique nullable `activeBindingKey` (set only while PENDING/APPROVED). Indexes: `(connectionId, status)`, `(status, expiresAt)`, `ownerId`, `bindingDigest`. FK connection (cascade).

**AgentApprovalDecision** — at most one per request (unique `approvalRequestId`). FK request (cascade), approver User (restrict).

## Back-relations

`AgentConnection.autonomyPolicies`, `AgentConnection.approvalRequests`, `User.agentAutonomyPoliciesCreated`, `User.agentApprovalDecisions`. No existing column changed.

## Applying

The live database has pre-existing Catalog* drift (see Phase 2/6 notes), so `prisma migrate deploy` must be reviewed first. Phase 6's migration `20260930000000_agent_gateway_phase6_policy_engine` must be applied before this one. Until both are applied, the gate fails closed (`POLICY_UNAVAILABLE`) for every tool call, because the policy tables do not exist.
