/**
 * lib/agent-gateway/auth/db-credential-store.ts
 *
 * DB-backed CredentialStore, satisfying the EXACT SAME interface Phase 1
 * defined in credential-store.ts. This is the "Phase 2 must replace
 * EnvCredentialStore with a DB-backed implementation — no caller changes"
 * migration promised in the Phase 1 architecture doc: BearerTokenAuthenticator,
 * SignedRequestAuthenticator, and HmacSignatureVerifier are UNCHANGED — only
 * the store implementation swaps.
 *
 * Delegates all actual lookup/state logic to AgentConnectionService
 * (identity/connection-service.ts) — this file is purely an adapter
 * shape, not a second place identity rules are implemented.
 */
import type { CredentialRecord, CredentialStatus, CredentialStore, SigningKeyRecord } from "./credential-store"
import { getAgentConnectionService } from "../identity/connection-service"
import { getCachedStatus, setCachedStatus } from "../identity/connection-cache"
import type { AgentMachineIdentity } from "../shared/types"

function toCredentialRecord(identity: AgentMachineIdentity): CredentialRecord {
  const status: CredentialStatus = identity.connectionStatus === "ACTIVE" ? "ACTIVE" : "INACTIVE"
  return {
    connectionId: identity.connectionId,
    agentId: identity.agentId,
    ownerId: identity.ownerId,
    teamId: identity.teamId ?? undefined,
    status,
    scopes: [], // Reserved for Phase 3 (AgentCapability) — Phase 2 never fabricates scopes.
    credentialId: identity.credentialId,
    connectionStatus: identity.connectionStatus,
  }
}

export class DbCredentialStore implements CredentialStore {
  async resolveBearerTokenHash(tokenHash: string): Promise<CredentialRecord | null> {
    const identity = await getAgentConnectionService().authenticateByHash(tokenHash)
    if (!identity) return null

    // Opportunistic cache warm — a subsequent request for the same
    // connection within the TTL window can short-circuit a DB read for
    // pure status checks elsewhere (identity/connection-cache.ts is
    // fail-open-to-DB by design, so this is a pure optimization, never a
    // trust decision).
    void setCachedStatus(identity.connectionId, identity.connectionStatus)

    return toCredentialRecord(identity)
  }

  async resolveSigningKey(keyId: string): Promise<SigningKeyRecord | null> {
    const resolved = await getAgentConnectionService().authenticateSigningKey(keyId)
    if (!resolved) return null

    void setCachedStatus(resolved.identity.connectionId, resolved.identity.connectionStatus)

    return { record: toCredentialRecord(resolved.identity), secret: resolved.signingSecret }
  }
}

// Exported for tests/inspection; the actual singleton wiring lives in
// credential-store.ts's getCredentialStore(), updated below to default to
// this implementation instead of EnvCredentialStore.
export function createDbCredentialStore(): CredentialStore {
  return new DbCredentialStore()
}

// getCachedStatus is re-exported here only so callers that want a pure
// status pre-check (e.g. a future admin UI) don't need to import from two
// different modules — not used internally by this file beyond the warm.
export { getCachedStatus }
