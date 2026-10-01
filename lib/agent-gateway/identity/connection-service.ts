/**
 * lib/agent-gateway/identity/connection-service.ts
 *
 * The AgentConnectionService — the ONLY place AgentConnection/AgentCredential
 * rows are read or written. Implements the full machine-identity lifecycle
 * (Phase 2 spec §7/§8/§19/§20/§21/§22/§27).
 *
 * SECURITY INVARIANTS (see docs/agent-gateway/phase-2/PHASE-2-ARCHITECTURE.md
 * §34 "Security Properties" for the full enumerated list; the load-bearing
 * ones enforced directly in this file are marked inline below):
 *   - Property 1: a REVOKED credential/connection never authenticates.
 *   - Property 2: a SUSPENDED connection never authenticates.
 *   - Property 3: a credential only ever resolves ITS OWN connection.
 *   - Property 8: rotation never exposes the old secret.
 *   - Property 9: revocation checks live status, never trusts a cache
 *     alone (see identity/connection-cache.ts's fail-open-to-DB design).
 *   - Every status write is compare-and-set on the status it was judged
 *     from (`transition()`, the conditional expiry writes, rotation's
 *     row lock), so concurrent writers can never overwrite a committed
 *     REVOKED: revoke is terminal even under races.
 *
 * This service uses the EXISTING Prisma client (lib/db.ts) and the
 * EXISTING User/Team models — it does not duplicate identity storage.
 */
import { db } from "@/lib/db"
import type { AgentConnection, AgentConnectionStatus, AgentCredential } from "@prisma/client"
import { GatewayError } from "../shared/errors"
import type { AgentConnectionStatusValue, AgentMachineIdentity } from "../shared/types"
import { assertLegalTransition } from "./state-machine"
import { invalidateConnectionStatus } from "./connection-cache"
import { encrypt } from "@/lib/encryption"
import {
  generateBearerToken,
  generateKeyId,
  generateSigningSecret,
  hashSecret,
  fingerprintSecret,
} from "../shared/crypto"
import { AGENT_LIFECYCLE_EVENTS, recordLifecycleEvent } from "../observability/lifecycle-events"

/**
 * How many times a lifecycle transition re-reads and retries after losing a
 * compare-and-set race (see PrismaAgentConnectionService.transition). One
 * retry already covers a single concurrent administrator; the bound only
 * stops a connection whose status keeps changing from looping forever.
 */
const MAX_TRANSITION_ATTEMPTS = 3

// ── Input/output contracts ──────────────────────────────────────────────────

export interface CreateAgentConnectionInput {
  name: string
  provider: string
  externalAgentId?: string
  description?: string
  ownerId: string
  teamId?: string
  environment?: string
  authMethod?: "BEARER" | "SIGNED_REQUEST"
  expiresAt?: Date
  /** Server-resolved actor performing the creation (an existing admin). Never client-supplied. */
  actorId: string
}

export interface AgentConnectionSummary {
  id: string
  name: string
  provider: string
  externalAgentId: string | null
  description: string | null
  ownerId: string
  teamId: string | null
  status: AgentConnectionStatus
  authMethod: AgentConnection["authMethod"]
  environment: string
  createdAt: Date
  lastAuthenticatedAt: Date | null
  lastSeenAt: Date | null
  expiresAt: Date | null
}

export interface CreatedAgentConnectionResult {
  connection: AgentConnectionSummary
  /**
   * The raw credential, returned EXACTLY ONCE at creation time. Never
   * persisted anywhere in plaintext, never retrievable again after this
   * call returns (Phase 2 spec §9). For BEARER this is the bearer token;
   * for SIGNED_REQUEST this is `{ keyId, signingSecret }` serialized —
   * modeled here as a discriminated shape so callers can't confuse the two.
   */
  credential:
    | { authMethod: "BEARER"; bearerToken: string }
    | { authMethod: "SIGNED_REQUEST"; keyId: string; signingSecret: string }
}

export interface CredentialRotationResult {
  connectionId: string
  newCredentialId: string
  oldCredentialId: string
  credential:
    | { authMethod: "BEARER"; bearerToken: string }
    | { authMethod: "SIGNED_REQUEST"; keyId: string; signingSecret: string }
}

export interface AgentConnectionService {
  create(input: CreateAgentConnectionInput): Promise<CreatedAgentConnectionResult>
  getById(connectionId: string): Promise<AgentConnectionSummary | null>
  authenticateCredential(rawSecret: string, authMethod: "BEARER"): Promise<AgentMachineIdentity | null>
  authenticateByHash(secretHash: string): Promise<AgentMachineIdentity | null>
  authenticateSigningKey(keyId: string): Promise<{ identity: AgentMachineIdentity; signingSecret: string } | null>
  rotateCredential(connectionId: string, actorId: string): Promise<CredentialRotationResult>
  suspend(connectionId: string, actorId: string): Promise<void>
  reactivate(connectionId: string, actorId: string): Promise<void>
  revoke(connectionId: string, actorId: string): Promise<void>
  recordAuthenticationSuccess(connectionId: string, credentialId: string): Promise<void>
}

function toSummary(row: AgentConnection): AgentConnectionSummary {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    externalAgentId: row.externalAgentId,
    description: row.description,
    ownerId: row.ownerId,
    teamId: row.teamId,
    status: row.status,
    authMethod: row.authMethod,
    environment: row.environment,
    createdAt: row.createdAt,
    lastAuthenticatedAt: row.lastAuthenticatedAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
  }
}

function toMachineIdentity(connection: AgentConnection, credential: AgentCredential): AgentMachineIdentity {
  return {
    agentId: connection.externalAgentId ?? undefined,
    connectionId: connection.id,
    credentialId: credential.id,
    ownerId: connection.ownerId,
    teamId: connection.teamId,
    provider: connection.provider,
    externalAgentId: connection.externalAgentId,
    connectionStatus: connection.status as AgentConnectionStatusValue,
    authenticatedAt: new Date(),
  }
}

export class PrismaAgentConnectionService implements AgentConnectionService {
  /**
   * Registration (Phase 2 spec §13). Requires an already-authorized actor
   * — this function does not itself check authorization; callers (the
   * admin API routes) MUST have already verified the actor via the
   * EXISTING requireSuperAdmin()/requireAdmin() before calling this.
   *
   * Validates owner existence server-side; never trusts a client-supplied
   * ownerId's mere presence as proof it's valid (Phase 2 spec §15).
   */
  async create(input: CreateAgentConnectionInput): Promise<CreatedAgentConnectionResult> {
    const owner = await db.user.findUnique({ where: { id: input.ownerId }, select: { id: true } })
    if (!owner) {
      throw new GatewayError("VALIDATION_FAILED", "The specified owner does not exist.")
    }
    if (input.teamId) {
      const team = await db.team.findUnique({ where: { id: input.teamId }, select: { id: true } })
      if (!team) {
        throw new GatewayError("VALIDATION_FAILED", "The specified team does not exist.")
      }
    }

    const authMethod = input.authMethod ?? "BEARER"

    const created = await db.$transaction(async (tx) => {
      const connection = await tx.agentConnection.create({
        data: {
          name: input.name,
          provider: input.provider,
          externalAgentId: input.externalAgentId,
          description: input.description,
          ownerId: input.ownerId,
          teamId: input.teamId,
          environment: input.environment ?? "development",
          authMethod,
          status: "PENDING",
          expiresAt: input.expiresAt,
          createdById: input.actorId,
        },
      })

      if (authMethod === "BEARER") {
        const bearerToken = generateBearerToken()
        await tx.agentCredential.create({
          data: {
            connectionId: connection.id,
            status: "ACTIVE",
            secretHash: hashSecret(bearerToken),
            fingerprint: fingerprintSecret(bearerToken),
            activatedAt: new Date(),
            expiresAt: input.expiresAt,
            createdById: input.actorId,
          },
        })
        // Activation follows successful credential issuance in the SAME
        // transaction — a connection is never left PENDING with no usable
        // credential due to a partial failure.
        const activated = await tx.agentConnection.update({
          where: { id: connection.id },
          data: { status: "ACTIVE" },
        })
        return { connection: activated, credential: { authMethod: "BEARER" as const, bearerToken } }
      }

      const keyId = generateKeyId()
      const signingSecret = generateSigningSecret()
      await tx.agentCredential.create({
        data: {
          connectionId: connection.id,
          status: "ACTIVE",
          secretHash: hashSecret(signingSecret),
          fingerprint: fingerprintSecret(signingSecret),
          keyId,
          signingSecretRef: encrypt(signingSecret),
          activatedAt: new Date(),
          expiresAt: input.expiresAt,
          createdById: input.actorId,
        },
      })
      const activated = await tx.agentConnection.update({
        where: { id: connection.id },
        data: { status: "ACTIVE" },
      })
      return { connection: activated, credential: { authMethod: "SIGNED_REQUEST" as const, keyId, signingSecret } }
    })

    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CONNECTION_CREATED,
      actorId: input.actorId,
      connectionId: created.connection.id,
      after: { name: input.name, provider: input.provider, ownerId: input.ownerId, teamId: input.teamId, status: created.connection.status },
    })
    const issuedFingerprint =
      created.credential.authMethod === "BEARER"
        ? fingerprintSecret(created.credential.bearerToken)
        : fingerprintSecret(created.credential.signingSecret)
    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CREDENTIAL_GENERATED,
      actorId: input.actorId,
      connectionId: created.connection.id,
      after: { authMethod, fingerprint: issuedFingerprint },
    })

    return { connection: toSummary(created.connection), credential: created.credential }
  }

  async getById(connectionId: string): Promise<AgentConnectionSummary | null> {
    const row = await db.agentConnection.findUnique({ where: { id: connectionId } })
    return row ? toSummary(row) : null
  }

  /** Bearer-token authentication path. Never logs or returns the raw secret. */
  async authenticateCredential(rawSecret: string): Promise<AgentMachineIdentity | null> {
    return this.authenticateByHash(hashSecret(rawSecret))
  }

  /**
   * Lower-level lookup by pre-computed hash — used by the DB-backed
   * CredentialStore adapter (auth/db-credential-store.ts), which receives
   * an already-hashed token per the Phase 1 CredentialStore interface
   * contract (`resolveBearerTokenHash(tokenHash)`).
   */
  async authenticateByHash(secretHash: string): Promise<AgentMachineIdentity | null> {
    const credential = await db.agentCredential.findUnique({
      where: { secretHash },
      include: { connection: true },
    })
    if (!credential) return null // Property 3 (implicit): a hash only ever resolves its own row.

    return this.evaluateCredentialForAuth(credential, credential.connection)
  }

  /** Signed-request authentication path. Returns the signing secret for the caller to verify the HMAC against. */
  async authenticateSigningKey(keyId: string): Promise<{ identity: AgentMachineIdentity; signingSecret: string } | null> {
    const credential = await db.agentCredential.findUnique({
      where: { keyId },
      include: { connection: true },
    })
    if (!credential || !credential.signingSecretRef) return null

    const identity = await this.evaluateCredentialForAuth(credential, credential.connection)
    if (!identity) return null

    const { decrypt } = await import("@/lib/encryption")
    const signingSecret = decrypt(credential.signingSecretRef)
    return { identity, signingSecret }
  }

  /**
   * Shared post-lookup evaluation for both auth paths. Enforces Properties
   * 1 and 2: revoked/expired credentials and non-ACTIVE connections never
   * authenticate, regardless of what the row's other fields say.
   */
  private async evaluateCredentialForAuth(
    credential: AgentCredential,
    connection: AgentConnection
  ): Promise<AgentMachineIdentity | null> {
    if (credential.status === "REVOKED") return null

    const credentialExpired =
      credential.status === "EXPIRED" || (credential.expiresAt !== null && credential.expiresAt.getTime() < Date.now())
    const connectionExpired = connection.expiresAt !== null && connection.expiresAt.getTime() < Date.now()

    if (credentialExpired || connectionExpired) {
      // Opportunistic, best-effort state-machine transition: the FIRST
      // authentication attempt after expiry observes the real-world fact
      // and persists it (ACTIVE -> EXPIRED is a legal transition). This is
      // NOT "extending" expiration (spec §22) — it never grants access; it
      // only records that expiry already happened, so the admin-facing
      // status reflects reality rather than staying ACTIVE forever until
      // some unrelated process notices.
      //
      // Both writes are conditional on the ACTIVE status read above: an
      // administrator's revoke/suspend (or a rotation) that committed after
      // this request's read must win. An unconditional write here could
      // turn REVOKED into EXPIRED, and REVOKED is terminal.
      if (connectionExpired && connection.status === "ACTIVE") {
        void db.agentConnection
          .updateMany({ where: { id: connection.id, status: "ACTIVE" }, data: { status: "EXPIRED" } })
          .then(() => invalidateConnectionStatus(connection.id))
          .catch(() => {})
      }
      if (credentialExpired && credential.status === "ACTIVE") {
        void db.agentCredential
          .updateMany({ where: { id: credential.id, status: "ACTIVE" }, data: { status: "EXPIRED" } })
          .catch(() => {})
      }
      return null
    }

    if (connection.status !== "ACTIVE") return null

    return toMachineIdentity(connection, credential)
  }

  /** Called by the transport layer after a successful authentication. Fire-and-forget-safe (best-effort metadata only). */
  async recordAuthenticationSuccess(connectionId: string, credentialId: string): Promise<void> {
    const now = new Date()
    await db
      .$transaction([
        db.agentConnection.update({ where: { id: connectionId }, data: { lastAuthenticatedAt: now, lastSeenAt: now } }),
        db.agentCredential.update({ where: { id: credentialId }, data: { lastUsedAt: now } }),
      ])
      .catch(() => {
        // Never let a metadata-write failure affect the (already-successful) authentication outcome.
      })
  }

  /**
   * Rotation with safe overlap (Phase 2 spec §19). The OLD credential is
   * marked ROTATING (still valid) while the NEW one is created and
   * returned; a caller may complete the overlap by later revoking the old
   * one explicitly, or this same call immediately revokes it if no grace
   * period is configured — Phase 2 uses immediate revocation (no
   * configurable grace window yet; see architecture doc's Known
   * Limitations) since introducing a time-based grace period requires a
   * scheduled job this phase does not add. This is documented, not silent.
   *
   * Idempotency: calling rotateCredential twice in quick succession creates
   * two new credentials and revokes the previous ACTIVE one each time —
   * this is NOT a no-op operation (rotation is inherently state-changing,
   * unlike suspend/revoke). What IS guaranteed is that at most one
   * credential is ever ACTIVE per connection after rotation completes
   * (Property: "new credential must become the only active credential
   * after grace completion") — including when two rotations run at once,
   * because the credential being replaced is read under the connection's
   * row lock (see the transaction below).
   */
  async rotateCredential(connectionId: string, actorId: string): Promise<CredentialRotationResult> {
    const connection = await db.agentConnection.findUnique({ where: { id: connectionId } })
    if (!connection) throw new GatewayError("CONNECTION_NOT_FOUND", "Connection not found.")

    // Fast, clear failure before any lock is taken; repeated under the lock below.
    const activeBeforeLock = await db.agentCredential.findFirst({
      where: { connectionId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    })
    if (!activeBeforeLock) {
      throw new GatewayError("VALIDATION_FAILED", "No active credential exists to rotate.")
    }

    const authMethod = connection.authMethod

    const result = await db.$transaction(async (tx) => {
      // The FIRST statement is a conditional write on the connection row.
      // It only matches while the connection is still ACTIVE, and in
      // Postgres it holds that row's lock until this transaction ends. A
      // plain re-read (the previous approach) takes no lock: a revoke()
      // committing after that read but before this commit could still
      // leave a brand-new ACTIVE credential under a REVOKED connection —
      // exactly the "revoked connection with a live credential" state
      // Property 1/9 forbid. With the lock, a concurrent revoke() either
      // committed first (nothing matches here and rotation aborts, rolling
      // back) or waits for this transaction and then revokes the new
      // credential too. revoke() always wins a race against rotate().
      const locked = await tx.agentConnection.updateMany({
        where: { id: connectionId, status: "ACTIVE" },
        data: { updatedById: actorId },
      })
      if (locked.count === 0) {
        throw new GatewayError(
          "ILLEGAL_STATE_TRANSITION",
          "Connection is no longer ACTIVE; rotation aborted to avoid racing a concurrent lifecycle change."
        )
      }

      // Re-read under the lock. A rotation that committed while this one
      // waited has already replaced the credential read above; rotating
      // that stale one would leave two ACTIVE credentials.
      const currentActive = await tx.agentCredential.findFirst({
        where: { connectionId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      })
      if (!currentActive) {
        throw new GatewayError("VALIDATION_FAILED", "No active credential exists to rotate.")
      }

      // Mark the old credential ROTATING first (still authenticatable —
      // "failure must not accidentally revoke the only usable credential
      // before a replacement exists").
      await tx.agentCredential.update({ where: { id: currentActive.id }, data: { status: "ROTATING" } })

      let newCredentialId: string
      let credentialOut: CredentialRotationResult["credential"]

      if (authMethod === "BEARER") {
        const bearerToken = generateBearerToken()
        const created = await tx.agentCredential.create({
          data: {
            connectionId,
            status: "ACTIVE",
            secretHash: hashSecret(bearerToken),
            fingerprint: fingerprintSecret(bearerToken),
            activatedAt: new Date(),
            replacesCredentialId: currentActive.id,
            createdById: actorId,
          },
        })
        newCredentialId = created.id
        credentialOut = { authMethod: "BEARER", bearerToken }
      } else {
        const keyId = generateKeyId()
        const signingSecret = generateSigningSecret()
        const created = await tx.agentCredential.create({
          data: {
            connectionId,
            status: "ACTIVE",
            secretHash: hashSecret(signingSecret),
            fingerprint: fingerprintSecret(signingSecret),
            keyId,
            signingSecretRef: encrypt(signingSecret),
            activatedAt: new Date(),
            replacesCredentialId: currentActive.id,
            createdById: actorId,
          },
        })
        newCredentialId = created.id
        credentialOut = { authMethod: "SIGNED_REQUEST", keyId, signingSecret }
      }

      // No configurable grace period in Phase 2 — the old credential is
      // revoked immediately once the new one is confirmed created, within
      // the same transaction, so there is never a window with zero valid
      // credentials nor a window with two credentials both silently active
      // beyond this single transaction's lifetime.
      await tx.agentCredential.update({
        where: { id: currentActive.id },
        data: { status: "REVOKED", revokedAt: new Date() },
      })

      return { newCredentialId, oldCredentialId: currentActive.id, credential: credentialOut }
    })

    await invalidateConnectionStatus(connectionId)
    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CREDENTIAL_ROTATED,
      actorId,
      connectionId,
      before: { oldCredentialId: result.oldCredentialId },
      after: { newCredentialId: result.newCredentialId },
    })
    return { connectionId, ...result }
  }

  /** Idempotent: suspending an already-SUSPENDED connection is a deterministic no-op success. */
  async suspend(connectionId: string, actorId: string): Promise<void> {
    const from = await this.transition(connectionId, "SUSPENDED", async (expected) => {
      const { count } = await db.agentConnection.updateMany({
        where: { id: connectionId, status: expected },
        data: { status: "SUSPENDED", suspendedAt: new Date(), updatedById: actorId },
      })
      return count > 0
    })
    if (from === null) return // idempotent no-op

    await invalidateConnectionStatus(connectionId)
    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CONNECTION_SUSPENDED,
      actorId,
      connectionId,
      before: { status: from },
      after: { status: "SUSPENDED" },
    })
  }

  /** The AI itself can never call this — only an authorized admin action path may invoke reactivate(). */
  async reactivate(connectionId: string, actorId: string): Promise<void> {
    const from = await this.transition(connectionId, "ACTIVE", async (expected) => {
      const { count } = await db.agentConnection.updateMany({
        where: { id: connectionId, status: expected },
        data: { status: "ACTIVE", suspendedAt: null, updatedById: actorId },
      })
      return count > 0
    })
    if (from === null) return // idempotent no-op

    await invalidateConnectionStatus(connectionId)
    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CONNECTION_REACTIVATED,
      actorId,
      connectionId,
      before: { status: from },
      after: { status: "ACTIVE" },
    })
  }

  /** Idempotent and terminal: revoking an already-REVOKED connection is a deterministic no-op success. */
  async revoke(connectionId: string, actorId: string): Promise<void> {
    const from = await this.transition(connectionId, "REVOKED", (expected) =>
      // Callback-form transaction (not array-form): array-form bundles
      // already-constructed query promises, which can start executing before
      // the transaction actually acquires its lock/slot. The callback form
      // guarantees both writes below execute atomically as a single unit,
      // which matters here because rotateCredential() locks the connection
      // row from inside its own transaction — it must never observe a
      // partially-applied revoke.
      db.$transaction(async (tx) => {
        const revokedAt = new Date()
        const { count } = await tx.agentConnection.updateMany({
          where: { id: connectionId, status: expected },
          data: { status: "REVOKED", revokedAt, updatedById: actorId },
        })
        // Lost a race: nothing was written, so there is nothing to roll back.
        if (count === 0) return false
        // Revoking the connection also revokes every non-revoked credential
        // under it — a revoked connection must never leave a technically
        // "ACTIVE" credential row that a stale check might still honor.
        await tx.agentCredential.updateMany({
          where: { connectionId, status: { not: "REVOKED" } },
          data: { status: "REVOKED", revokedAt },
        })
        return true
      })
    )
    if (from === null) return // idempotent no-op

    await invalidateConnectionStatus(connectionId)
    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CONNECTION_REVOKED,
      actorId,
      connectionId,
      before: { status: from },
      after: { status: "REVOKED" },
    })
  }

  /**
   * Compare-and-set status change shared by suspend / reactivate / revoke.
   *
   * `write(expected)` must apply the change ONLY while the row still has
   * status `expected` (a conditional `updateMany`, i.e. one
   * `UPDATE ... WHERE id = $1 AND status = $2`) and report whether it did.
   * The previous read-then-`update` let two administrators overwrite each
   * other: a suspend that read ACTIVE could land after a concurrent revoke
   * and turn REVOKED back into SUSPENDED (or a reactivate turn it into
   * ACTIVE). Now the losing write matches nothing, and the loop re-reads
   * and judges again: the target already reached is the usual idempotent
   * no-op; anything else goes back through the state machine, so every
   * transition out of REVOKED is ILLEGAL_STATE_TRANSITION (409).
   *
   * Returns the status the connection actually moved from, or null when it
   * was already in `target` (nothing written, nothing to record).
   */
  private async transition(
    connectionId: string,
    target: AgentConnectionStatus,
    write: (expected: AgentConnectionStatus) => Promise<boolean>
  ): Promise<AgentConnectionStatus | null> {
    for (let attempt = 0; attempt < MAX_TRANSITION_ATTEMPTS; attempt += 1) {
      const connection = await this.requireConnection(connectionId)
      if (connection.status === target) return null
      assertLegalTransition(connection.status, target)
      if (await write(connection.status)) return connection.status
    }
    // Only reachable when the status changed underneath on every attempt.
    throw new GatewayError("ILLEGAL_STATE_TRANSITION", "The connection changed concurrently; reload it and try again.")
  }

  private async requireConnection(connectionId: string): Promise<AgentConnection> {
    const connection = await db.agentConnection.findUnique({ where: { id: connectionId } })
    if (!connection) throw new GatewayError("CONNECTION_NOT_FOUND", "Connection not found.")
    return connection
  }
}

let serviceSingleton: AgentConnectionService | null = null

export function getAgentConnectionService(): AgentConnectionService {
  if (!serviceSingleton) serviceSingleton = new PrismaAgentConnectionService()
  return serviceSingleton
}

/** Test-only: inject a fake service. */
export function __setAgentConnectionServiceForTests(service: AgentConnectionService | null): void {
  serviceSingleton = service
}
