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
      if (connectionExpired && connection.status === "ACTIVE") {
        void db.agentConnection
          .update({ where: { id: connection.id }, data: { status: "EXPIRED" } })
          .then(() => invalidateConnectionStatus(connection.id))
          .catch(() => {})
      }
      if (credentialExpired && credential.status === "ACTIVE") {
        void db.agentCredential.update({ where: { id: credential.id }, data: { status: "EXPIRED" } }).catch(() => {})
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
   * after grace completion").
   */
  async rotateCredential(connectionId: string, actorId: string): Promise<CredentialRotationResult> {
    const connection = await db.agentConnection.findUnique({ where: { id: connectionId } })
    if (!connection) throw new GatewayError("CONNECTION_NOT_FOUND", "Connection not found.")

    const currentActive = await db.agentCredential.findFirst({
      where: { connectionId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    })
    if (!currentActive) {
      throw new GatewayError("VALIDATION_FAILED", "No active credential exists to rotate.")
    }

    const authMethod = connection.authMethod

    const result = await db.$transaction(async (tx) => {
      // Re-check the connection's live status from inside the transaction.
      // The reads above (findUnique/findFirst) happened before this
      // transaction acquired its slot, so a concurrent revoke() could have
      // already committed in the gap between those reads and this point.
      // Without this re-check, rotation would create a brand-new ACTIVE
      // credential under a connection that is no longer ACTIVE — exactly
      // the "revoked connection with a live credential" state Property 1/9
      // forbid. Aborting here (and letting the transaction roll back)
      // guarantees revoke() always wins a race against rotate().
      const freshConnection = await tx.agentConnection.findUnique({ where: { id: connectionId } })
      if (!freshConnection || freshConnection.status !== "ACTIVE") {
        throw new GatewayError(
          "ILLEGAL_STATE_TRANSITION",
          "Connection is no longer ACTIVE; rotation aborted to avoid racing a concurrent lifecycle change."
        )
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
    const connection = await this.requireConnection(connectionId)
    if (connection.status === "SUSPENDED") return // idempotent no-op
    assertLegalTransition(connection.status, "SUSPENDED")

    await db.agentConnection.update({
      where: { id: connectionId },
      data: { status: "SUSPENDED", suspendedAt: new Date(), updatedById: actorId },
    })
    await invalidateConnectionStatus(connectionId)
    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CONNECTION_SUSPENDED,
      actorId,
      connectionId,
      before: { status: connection.status },
      after: { status: "SUSPENDED" },
    })
  }

  /** The AI itself can never call this — only an authorized admin action path may invoke reactivate(). */
  async reactivate(connectionId: string, actorId: string): Promise<void> {
    const connection = await this.requireConnection(connectionId)
    if (connection.status === "ACTIVE") return // idempotent no-op
    assertLegalTransition(connection.status, "ACTIVE")

    await db.agentConnection.update({
      where: { id: connectionId },
      data: { status: "ACTIVE", suspendedAt: null, updatedById: actorId },
    })
    await invalidateConnectionStatus(connectionId)
    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CONNECTION_REACTIVATED,
      actorId,
      connectionId,
      before: { status: connection.status },
      after: { status: "ACTIVE" },
    })
  }

  /** Idempotent and terminal: revoking an already-REVOKED connection is a deterministic no-op success. */
  async revoke(connectionId: string, actorId: string): Promise<void> {
    const connection = await this.requireConnection(connectionId)
    if (connection.status === "REVOKED") return // idempotent no-op
    assertLegalTransition(connection.status, "REVOKED")

    // Callback-form transaction (not array-form): array-form bundles
    // already-constructed query promises, which can start executing before
    // the transaction actually acquires its lock/slot. The callback form
    // guarantees both writes below execute atomically as a single unit,
    // which matters here because rotateCredential() re-checks connection
    // status from inside its own transaction — that re-check must never
    // observe a partially-applied revoke.
    await db.$transaction(async (tx) => {
      await tx.agentConnection.update({
        where: { id: connectionId },
        data: { status: "REVOKED", revokedAt: new Date(), updatedById: actorId },
      })
      // Revoking the connection also revokes every non-revoked credential
      // under it — a revoked connection must never leave a technically
      // "ACTIVE" credential row that a stale check might still honor.
      await tx.agentCredential.updateMany({
        where: { connectionId, status: { not: "REVOKED" } },
        data: { status: "REVOKED", revokedAt: new Date() },
      })
    })
    await invalidateConnectionStatus(connectionId)
    recordLifecycleEvent({
      action: AGENT_LIFECYCLE_EVENTS.CONNECTION_REVOKED,
      actorId,
      connectionId,
      before: { status: connection.status },
      after: { status: "REVOKED" },
    })
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
