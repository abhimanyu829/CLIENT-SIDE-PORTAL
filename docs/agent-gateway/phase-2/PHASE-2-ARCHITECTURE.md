# Phase 2 — Machine Identity & AgentConnection Lifecycle

Status: IMPLEMENTED. Additive only — no existing model, route, or business flow was modified beyond additive back-relations on `User`/`Team`. See the final report (delivered in-chat) for the full closure report.

## 1. What this phase adds

A real, database-backed machine identity: `AgentConnection` (the identity itself — one per registered AI agent/integration) and `AgentCredential` (the secret material bound to a connection, with its own independent lifecycle). Phase 1's `EnvCredentialStore` is retired as the default; a DB-backed `CredentialStore` now resolves every bearer token and signing key against these tables. No `AgentCapability`, MCP tool, policy, approval, or budget concept exists yet — that is out of scope until Phase 3+.

## 2. Storage decision

**Chosen: extend the existing Prisma schema additively**, reusing the existing `User`/`Team` models via relations, rather than a separate identity database or duplicate user table. `AgentConnection.ownerId`/`teamId` are real foreign keys into `User`/`Team`. Rejected: a standalone identity store — the spec explicitly forbids duplicating identity, and this app already has exactly one source of truth for "who owns what."

## 3. Connection lifecycle (state machine)

```
PENDING ──────► ACTIVE ──────► SUSPENDED ──────► ACTIVE   (reactivate)
   │               │                │
   │               ▼                ▼
   └────────────► REVOKED ◄────── REVOKED
                    │
                    ▼
                (terminal — no further transitions)

ACTIVE ──────► EXPIRED ──────► REVOKED
```

Enforced centrally by `identity/state-machine.ts`'s `LEGAL_TRANSITIONS` map and `assertLegalTransition()`. `REVOKED` is terminal. Same-state "transitions" (e.g. suspend on an already-SUSPENDED connection) are always legal and handled as idempotent no-ops by the callers in `connection-service.ts`, not by the state machine itself — the state machine only judges *different-state* transitions.

## 4. Credential lifecycle

```
GENERATED (= created ACTIVE, at connection creation or rotation)
   │
   ▼
ACTIVE ──────► ROTATING ──────► REVOKED
   │                               ▲
   └───────────────────────────────┘  (direct revoke, e.g. connection revoked)
```

A credential is created ACTIVE. Rotating it marks the old one ROTATING then REVOKED within the same transaction the new one is created in — there is no configurable overlap/grace window in Phase 2 (see Known Limitations, §16). Revoking a connection bulk-revokes every non-REVOKED credential under it via `updateMany`.

## 5. Owner/team binding

`AgentConnection.ownerId` (required) and `AgentConnection.teamId` (optional) are plain foreign keys to the existing `User`/`Team` models. `create()` validates both exist server-side before writing anything (`VALIDATION_FAILED` if not) — the caller (always an admin, never the AI itself) supplies these IDs, but they are checked against the real tables, never trusted blindly.

## 6. Environment boundary

`AgentConnection.environment` (`development`/`staging`/`production`, free string) is informational only. The actual environment boundary is deployment topology — separate env vars and/or separate databases per deployment, matching how this app already separates environments. Nothing in Phase 2 cross-checks a credential's environment against the request's environment; that enforcement point does not exist yet and is not claimed to.

## 7. Secret storage — zero plaintext

- **Bearer tokens**: `AgentCredential.secretHash` = SHA-256 of the raw token. One-way, never reversible. The raw token is returned to the caller exactly once, at creation/rotation time, in the API response body — never persisted, never logged.
- **Signing secrets** (SIGNED_REQUEST): `AgentCredential.signingSecretRef` stores the secret encrypted with the **existing** `lib/encryption.ts` AES-256-GCM utility. This is an interim measure, not a dedicated secret manager — documented explicitly as a Known Limitation (§16). `keyId` (public, non-secret) is what a client presents to look up the credential; the encrypted secret is only decrypted server-side when verifying a signature.
- **Fingerprint**: `AgentCredential.fingerprint` is a separate, non-secret, non-reversible derivation (double-hash, truncated) safe to display/log for identification — it can never be used to authenticate and is never equal to `secretHash`.

## 8. Authentication flow (extends Phase 1, no caller changes)

```
bearer-authenticator.ts / signed-request-authenticator.ts
   │
   ▼
auth/credential-store-provider.ts → getCredentialStore()
   │
   ├─ AGENT_GATEWAY_CREDENTIAL_STORE=env  → EnvCredentialStore (Phase 1, kept for tests only)
   └─ default                             → DbCredentialStore (Phase 2)
   │
   ▼
DbCredentialStore.resolveBearerTokenHash() / resolveSigningKey()
   │
   ▼
identity/connection-service.ts → PrismaAgentConnectionService.authenticateByHash() / authenticateSigningKey()
   │
   ▼
evaluateCredentialForAuth(): REVOKED credential → null
                              expired credential/connection → null (+ best-effort async transition to EXPIRED)
                              non-ACTIVE connection → null
   │
   ▼
AgentMachineIdentity { connectionId, credentialId, ownerId, teamId?, connectionStatus, ... }
```

The `CredentialStore` interface itself (`resolveBearerTokenHash`, `resolveSigningKey`) is unchanged from Phase 1 — `DbCredentialStore` implements the exact same contract `EnvCredentialStore` did, so `bearer-authenticator.ts` and `signed-request-authenticator.ts` needed only an import-path change, not a logic change.

## 9. Identity resolution and the HTTP boundary

`identity/request-identity.ts`'s `buildRequestContext()` now also populates `context.machine: AgentMachineIdentity | undefined` — only when `connectionId`, `credentialId`, and `connectionStatus` are all present from the authenticator's result. It is never fabricated from a client-supplied header. `transport/http-boundary.ts` fire-and-forgets `recordAuthenticationSuccess()` after a successful auth so `lastAuthenticatedAt`/`lastSeenAt` update without adding latency to the response path.

## 10. Anti-enumeration error contract

Internal failure reasons (`CONNECTION_SUSPENDED`, `CONNECTION_REVOKED`, `CREDENTIAL_EXPIRED`, `CONNECTION_NOT_FOUND`, etc.) are granular for audit/log purposes but collapse to a single external `AUTH_INVALID` at the HTTP boundary — `auth/error-mapping.ts`'s `toExternalAuthErrorCode()` is the one place this collapse happens. `AUTH_REQUIRED` (no credential presented at all) is the only internal code that passes through unchanged, since "you didn't send anything" leaks nothing about any specific connection's existence or state. This was corrected mid-implementation after an initial version of `http-boundary.ts` passed internal codes straight through — caught before the phase closed out.

## 11. Race conditions and idempotency

- **suspend/reactivate/revoke**: idempotent no-op if already in the target state; otherwise validated through `assertLegalTransition` and applied as a **compare-and-set** write: `updateMany({ where: { id, status: <status just read> } })`, i.e. one `UPDATE … WHERE id = $1 AND status = $2`. If another administrator changed the status in between, the write matches nothing; the service re-reads and judges again (target already reached → idempotent no-op; otherwise the state machine decides, so anything out of `REVOKED` is `409 ILLEGAL_STATE_TRANSITION`). At most 3 attempts, then a stable 409. The lifecycle audit event records the status actually transitioned from, and only the winning call records one.
- **Fixed after Phase 10 (P2):** these transitions were originally read-then-`update`, so a suspend (or reactivate) that read `ACTIVE`/`SUSPENDED` could land after a concurrent revoke and overwrite `REVOKED`. Credentials stayed revoked (the agent could not authenticate), but "revoke is terminal" did not hold under that race. The same fix covers the opportunistic expiry in `evaluateCredentialForAuth` (the `ACTIVE → EXPIRED` writes for the connection and the credential are conditional on `ACTIVE`, so they can no longer turn `REVOKED` into `EXPIRED`). Existing rows are not rewritten; the fix prevents new occurrences. Covered by `connection-lifecycle-race.test.ts`, which forces each interleaving deterministically (7 of its 9 tests fail against the old code).
- **Concurrent revoke × revoke**: both resolve without corrupting state — the second call's write matches nothing, it re-reads `REVOKED` and no-ops.
- **Concurrent rotate × revoke**: the first statement of `rotateCredential()`'s transaction is a conditional write on the connection row (`updateMany({ where: { id, status: "ACTIVE" } })`), which takes that row's lock in Postgres. A revoke that committed first makes it match nothing (rotation aborts with `ILLEGAL_STATE_TRANSITION` and rolls back); a revoke that arrives during the rotation waits for it and then revokes the new credential too. Revoke always wins — a connection can never end up REVOKED with a credential a concurrent rotation left ACTIVE. (The original in-transaction re-read took no lock, so under Postgres READ COMMITTED it did not fully guarantee this.) Covered by `connection-failure.test.ts` and `connection-lifecycle-race.test.ts`.
- **Concurrent rotate × rotate**: the credential being replaced is read under that same row lock, so the second rotation replaces the first one's new credential; exactly one credential is ACTIVE afterwards (previously both new credentials could stay ACTIVE).
- **Rotation transactionality**: old-credential-ROTATING → new-credential-CREATE → old-credential-REVOKED all happen inside one `db.$transaction`, so a mid-transaction failure (simulated in `connection-failure.test.ts`) rolls back cleanly — the old credential is never left stuck in ROTATING with no usable replacement.

## 12. Connection-status cache

`identity/connection-cache.ts` reuses the **existing** Redis client (`lib/redis.ts`). Key: `agent-gateway:conn-status:<connectionId>`, fixed 30s TTL, explicitly invalidated on every lifecycle mutation (rotate/suspend/reactivate/revoke). Deliberately **fails open to the DB** on any Redis error or absence — unlike Phase 1's rate-limiter and replay-protection (which fail closed because they are security controls), this cache is a pure performance optimization and the DB is always the authoritative source of connection status.

## 13. Security events / audit

Reuses the **existing** `lib/audit.ts`'s `auditLog()`, which writes to the **existing** `AuditLog` Prisma model — no new `AgentAuditLog` ledger was built, per the explicit "do not prematurely implement" instruction. `observability/lifecycle-events.ts` defines the 8 lifecycle event constants (`AGENT_CONNECTION_CREATED`, `AGENT_CREDENTIAL_GENERATED`, `AGENT_CREDENTIAL_ROTATED`, `AGENT_CREDENTIAL_REVOKED`, `AGENT_CONNECTION_SUSPENDED`, `AGENT_CONNECTION_REACTIVATED`, `AGENT_CONNECTION_REVOKED`, `AGENT_CONNECTION_EXPIRED`) and `recordLifecycleEvent()`, a thin wrapper so callers never call `auditLog()` with ad-hoc shapes.

## 14. Admin API surface (all new, all `requireSuperAdmin()`-gated)

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/agent-connections` | POST | Create connection + first credential |
| `/api/admin/agent-connections` | GET | List connections (safe fields only) |
| `/api/admin/agent-connections/[id]` | GET | Connection detail + credential list (fingerprint only, never secret) |
| `/api/admin/agent-connections/[id]/suspend` | POST | Suspend |
| `/api/admin/agent-connections/[id]/reactivate` | POST | Reactivate |
| `/api/admin/agent-connections/[id]/revoke` | POST | Revoke (terminal) |
| `/api/admin/agent-connections/[id]/rotate` | POST | Rotate credential (returns new secret once) |

`requireSuperAdmin()` (not `requireAdmin()`) was used because connection/credential provisioning is CRITICAL-tier per Phase 0's risk classification — this mirrors the exact convention of the existing `app/api/admin/subadmins/accounts/route.ts`. `actorId` for every mutation is always taken from the authenticated admin session, never from the request body.

## 15. Database changes

Additive only — new enums `AgentConnectionStatus`, `AgentAuthMethod`, `AgentCredentialStatus`; new models `AgentConnection`, `AgentCredential`; new back-relations on `User` (`agentConnectionsOwned`, `agentConnectionsCreated`, `agentConnectionsUpdated`, `agentCredentialsCreated`) and `Team` (`agentConnections`). No existing column, index, or constraint was altered or dropped. Migration applied to the production database as `20260929000000_agent_gateway_phase2_identity` via a hand-verified additive-only SQL script (see §17).

## 16. Known limitations (explicit, not silently accepted)

1. **No configurable rotation grace period.** The old credential is revoked in the same transaction the new one is created, so there is never a window where both are valid beyond that single transaction. A real "old token still works for N minutes after rotation" grace window is not implemented.
2. **Signing secrets are encrypted with the app's general-purpose `lib/encryption.ts` utility, not a dedicated secret manager** (e.g. AWS Secrets Manager, Vault). This is documented as interim; the Phase 0 audit already flagged this as an open decision.
3. **No environment enforcement.** `AgentConnection.environment` is informational; nothing currently rejects a `development`-tagged credential used against a `production`-configured gateway instance.
4. **Expiration is opportunistic, not scheduled.** A connection/credential past `expiresAt` is only transitioned to `EXPIRED` in the DB when something happens to check it (an auth attempt) — there is no background job sweeping expired rows. Reads always compute expiry correctly regardless (`evaluateCredentialForAuth` checks the timestamp directly), so this does not create an authentication gap; it only means the `status` column can lag reality until the next auth attempt or admin action touches that row.
5. **`recordAuthenticationSuccess` is fire-and-forget.** `lastAuthenticatedAt`/`lastSeenAt` updates are not guaranteed to complete before the response is sent; a crash between response and write would lose that one timestamp update (not a security issue, since it does not gate authentication decisions).

## 17. Migration application note

`npx prisma migrate dev` could not run cleanly against the shadow database because of a pre-existing, unrelated migration-history issue (`20260717180000_enterprise_subadmin_workforce` fails to replay against a clean shadow DB with `P1014: The underlying table for model 'User' does not exist` — a problem that predates this phase and was not introduced by it). Instead: `prisma migrate diff` was used to generate the raw SQL diff against the live DB, which was then manually reviewed — it included destructive `DROP TABLE` statements for the orphaned `Catalog*` tables from the earlier catalog-crawler removal (out of scope for this phase, and those tables are known to still exist in the DB even though their Prisma models were removed). Those drop statements were excluded; only the additive Agent Gateway objects (3 enums, 2 tables, their indexes and foreign keys) were extracted into `prisma/migrations/20260929000000_agent_gateway_phase2_identity/migration.sql`, applied via `prisma db execute`, and then registered as applied via `prisma migrate resolve --applied`. Verified post-apply: `AgentConnection`/`AgentCredential` tables exist and are queryable via the generated Prisma client (0 rows in each, as expected for a fresh table). `prisma migrate status` confirms this migration is now tracked as applied; the only outstanding "not applied" entry is the pre-existing orphaned `20260916090000_catalog_intelligence` migration, unrelated to this phase and explicitly out of scope to touch.

## 18. Phase 3 prerequisites

- Design `AgentCapability` (what a connection is allowed to *do*, as opposed to *who it is*, which Phase 2 covers).
- Decide the real secret-manager migration path referenced in §16.2.
- Add environment enforcement if cross-environment credential use turns out to be a real risk in practice.
- Consider a scheduled sweep for `EXPIRED` transitions if the opportunistic model (§16.4) proves insufficient for any downstream reporting need.
