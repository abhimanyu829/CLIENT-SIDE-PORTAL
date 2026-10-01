# Phase 10 — Autonomy Management

Autonomy (Phase 7) only narrows what Phase 6 allows: level, highest risk tier without approval, capability allowlist, always-approve list, environments, expiry. It is edited on the connection page through the **existing** route.

| Operation | Route |
|---|---|
| Save (version N+1) | `PUT /api/admin/agent-connections/[id]/autonomy` with `expectedVersion` |
| Disable (back to observe-only) | `DELETE …/autonomy?expectedVersion=<active version>` |

## Optimistic concurrency (additive)

- `expectedVersion` is the newest version number the administrator saw (`0` = never configured). `setAutonomyPolicy` checks it inside its transaction before writing; a stale value writes nothing → `409 CONFLICT`. A concurrent writer passing the same check loses on the unique `(connectionId, version)` → `409`.
- `DELETE` with `expectedVersion` disables only that ACTIVE version; a different ACTIVE version is a conflict; no ACTIVE version is a no-op success.
- Both fields are optional, so earlier callers keep working (tested).

## Effect and safety

- The autonomy store has no cache: a change applies to the next agent request, queued tasks are re-checked at execution, and approvals granted under the previous version can no longer be consumed (`APPROVAL_POLICY_CHANGED`, Scenario 7).
- Raising autonomy (full scoped autonomy, high-risk or critical tiers) shows a destructive confirmation; every save is confirmed.
- Mandatory approvals still apply at any level.

## The autonomy page

Lists ACTIVE autonomy policies (filter by level, paginated) and the number of live connections without one (default observe-only posture).
