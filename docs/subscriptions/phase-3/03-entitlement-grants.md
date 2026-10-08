# 03 — Entitlement Grants (Phase 3)

## Lifecycle

```
PENDING → ACTIVE | REVOKED
ACTIVE  → SUSPENDED | REVOKED | EXPIRED
SUSPENDED → ACTIVE | REVOKED
EXPIRED  → (terminal)
REVOKED  → (terminal)
```
Same-status = idempotent no-op. Terminal states never exit; a REVOKED grant is
never resurrected. Grants are never physically deleted to remove access —
history stays for billing/audit (status-based revocation).

## Operations (backend service only; no HTTP routes)

- `grantEntitlement(input, actor)` — validates definition (exists + active),
  subject (exists + not banned), source type, scope/resource consistency,
  expiry > start; computes `dedupeKey`; idempotent.
- `revokeEntitlement(id, actor, reason)` / `suspendEntitlement` /
  `restoreEntitlement` — guarded transitions + CAS (`updateMany where status`),
  audited, cache invalidated.
- `expireStaleGrants(now)` — worker cleanup marks ACTIVE grants whose window
  passed as EXPIRED. Access checks NEVER depend on this job.

## Audit

Every mutation writes an `AuditLog` row (`ENTITLEMENT_GRANTED`,
`ENTITLEMENT_REVOKED`, `ENTITLEMENT_SUSPENDED`, `ENTITLEMENT_RESTORED`,
`ENTITLEMENT_DEFINITION_CREATED`, ...).

## Client-trust rules

- No client-supplied status, expiry, quantity, owner or team.
- Subject ids are verified against `User` / `Team`; banned users cannot hold
  new grants.
- `SOURCE` values are validated against the controlled enum; unknown sources throw.

## Access effect

Only `ACTIVE` grants inside `[startsAt, expiresAt)` resolve.
PENDING, SUSPENDED, EXPIRED and REVOKED never resolve — immediately.