# Phase 10 — Policy Management

Phase 6 policies are versioned and immutable: a change is always version N+1; the previous version is kept as `SUPERSEDED`.

| Operation | Route | Body (strict) |
|---|---|---|
| Create | `POST /api/admin/agent-governance/policies` | `name`, `description?`, `priority?`, `enabled?`, `effect`, `scope`, `scopeValue?`, `capabilityId?`, `riskConstraint?`, `approvalRequirement?`, `conditions?`, `note?` |
| Publish version | `POST …/policies/[id]/versions` | the version fields + **`expectedCurrentVersion`** |
| Roll back | `POST …/policies/[id]/rollback` | `targetVersion`, **`expectedCurrentVersion`**, `reason?` — publishes a copy of the target as a new version |
| Disable (kill switch) | `POST …/policies/[id]/disable` | `reason?` |
| Enable | `POST …/policies/[id]/enable` | `reason?` |

## Server-side validation

- scope `GLOBAL` / `CAPABILITY` take no scope value; `OWNER`, `TEAM`, `CONNECTION`, `RESOURCE_TYPE`, `RESOURCE`, `ENVIRONMENT` require a plain identifier; `ENVIRONMENT` must be a known environment;
- `CAPABILITY` requires a capability; any capability id must be registered;
- conditions go through the existing `assertWellFormedCondition` (declarative operators only; never code);
- the actor (`createdById`) is always the session user; unknown keys are rejected.

## Optimistic concurrency

`createPolicyVersion` gained an optional `expectedCurrentVersion` (Phase 6 store, additive). Inside the existing transaction it compares the head version **before any write**; a mismatch throws `PolicyConflictError` → `409 CONFLICT`. Two administrators publishing on the same version: the serialized transaction lets one through, the other sees the new head (or loses the unique `(policyId, version)`) → exactly one winner (tested).

## Effect

The policy cache is invalidated by every write (existing behaviour), so a publish or a kill switch applies to the **next authorization**, including queued tasks (re-checked at execution) and trigger firings (tested in Scenario 6, Scenario 10 and master step 17). Enable/disable is idempotent; a repeated call writes no audit entry.

## Confirmation

Creating or publishing is confirmed (a global ALLOW is flagged as destructive); disabling and rolling back require a reason, which is audited.
