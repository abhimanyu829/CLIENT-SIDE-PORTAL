# Phase 7 — Database Verification

| Check | Result |
|---|---|
| `prisma validate` | OK |
| `prisma generate` | OK; client exposes `agentAutonomyPolicy`, `agentApprovalRequest`, `agentApprovalDecision` (tsc passes against it) |
| Schema diff | additive only: 4 enums, 3 models, 4 back-relation fields; no existing column/table changed |
| Migration SQL | `CREATE TYPE` ×4, `CREATE TABLE` ×3, unique indexes (`connectionId+version`, `publicRef`, `activeBindingKey`, `approvalRequestId`), lookup indexes, FKs (connection cascade, users restrict) |
| Applied to a database | **No** |

## Why not applied

The target is the live production Supabase database, which has pre-existing Catalog* drift. Applying migrations there is a high-risk, hard-to-reverse change and needs your explicit go-ahead. Order when you do: Phase 6 `20260930000000_…` then Phase 7 `20261001000000_…`, after reviewing `prisma migrate diff` against the live schema.

## Integrity guarantees relied on (and reproduced by the test fake)

- `activeBindingKey` unique and nullable: at most one live request per connection+binding.
- `publicRef` unique.
- `AgentApprovalDecision.approvalRequestId` unique: at most one decision per request.
- Conditional `updateMany` on status/digest/expiry for every transition.
