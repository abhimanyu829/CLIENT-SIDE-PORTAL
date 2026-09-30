/**
 * lib/agent-gateway/auth/credential-store.ts
 *
 * Credential resolution abstraction. Phase 1 deliberately does NOT add an
 * AgentConnection database model (per Phase 1 scope — deferred to Phase 2).
 * Instead this defines the interface a future DB-backed store must satisfy,
 * plus a minimal, explicitly-temporary env-var-backed implementation so the
 * gateway pipeline (auth → identity → rate limit → routing) can be built,
 * tested, and exercised end-to-end today.
 *
 * SECURITY:
 *  - Bearer tokens are never stored or compared in plaintext — only their
 *    SHA-256 hash is ever looked up (see shared/crypto.ts sha256Hex).
 *  - Signing secrets are read from env only; never logged, never returned
 *    by any diagnostic/health endpoint.
 *  - This store returns `null` for any unresolvable credential — callers
 *    must treat that identically to "invalid", never as "not yet checked".
 */
import { sha256Hex } from "../shared/crypto"

export type CredentialStatus = "ACTIVE" | "INACTIVE"

export interface CredentialRecord {
  connectionId: string
  agentId?: string
  ownerId: string
  teamId?: string
  status: CredentialStatus
  scopes: string[]
  /**
   * Phase 2 fields. Optional because EnvCredentialStore (Phase 1 bootstrap)
   * has no real credential/connection-status concept of its own — it sets
   * these to undefined, and buildRequestContext() correctly omits the full
   * `machine` identity in that case rather than fabricating a fake one.
   */
  credentialId?: string
  connectionStatus?: "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED"
}

export interface SigningKeyRecord {
  record: CredentialRecord
  secret: string
}

export interface CredentialStore {
  /** Look up a bearer credential by the SHA-256 hash of the raw token. */
  resolveBearerTokenHash(tokenHash: string): Promise<CredentialRecord | null>
  /** Look up a signing key (for HMAC-signed requests) by its public key id. */
  resolveSigningKey(keyId: string): Promise<SigningKeyRecord | null>
}

interface EnvCredentialEntry {
  connectionId: string
  agentId?: string
  ownerId: string
  teamId?: string
  status?: CredentialStatus
  scopes?: string[]
  /** Raw bearer token — hashed once at load time, never retained in plaintext beyond this parse. */
  bearerToken?: string
  /** Signing key id + shared secret, for the SIGNED_REQUEST auth method. */
  keyId?: string
  signingSecret?: string
}

/**
 * TEMPORARY Phase 1 bootstrap store. Reads a JSON array from
 * AGENT_GATEWAY_CREDENTIALS_JSON. This env var is intentionally NOT added
 * to lib/env.ts (the main app schema) — it is gateway-only config, parsed
 * defensively so a malformed value degrades to "no credentials" rather
 * than crashing the host process.
 *
 * Phase 2 must replace this with an AgentConnection-backed implementation
 * of the same CredentialStore interface — no caller of this interface
 * needs to change when that happens.
 */
export class EnvCredentialStore implements CredentialStore {
  private byTokenHash = new Map<string, CredentialRecord>()
  private byKeyId = new Map<string, SigningKeyRecord>()

  constructor() {
    const raw = process.env.AGENT_GATEWAY_CREDENTIALS_JSON
    if (!raw) return
    let entries: EnvCredentialEntry[]
    try {
      entries = JSON.parse(raw)
      if (!Array.isArray(entries)) throw new Error("not an array")
    } catch {
      // Malformed config must fail closed (no credentials resolve), never throw at import time.
      return
    }
    for (const entry of entries) {
      if (!entry.connectionId || !entry.ownerId) continue
      const record: CredentialRecord = {
        connectionId: entry.connectionId,
        agentId: entry.agentId,
        ownerId: entry.ownerId,
        teamId: entry.teamId,
        status: entry.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        scopes: Array.isArray(entry.scopes) ? entry.scopes : [],
      }
      if (entry.bearerToken) {
        this.byTokenHash.set(sha256Hex(entry.bearerToken), record)
      }
      if (entry.keyId && entry.signingSecret) {
        this.byKeyId.set(entry.keyId, { record, secret: entry.signingSecret })
      }
    }
  }

  async resolveBearerTokenHash(tokenHash: string): Promise<CredentialRecord | null> {
    return this.byTokenHash.get(tokenHash) ?? null
  }

  async resolveSigningKey(keyId: string): Promise<SigningKeyRecord | null> {
    return this.byKeyId.get(keyId) ?? null
  }
}

// NOTE: the process-wide singleton wiring (getCredentialStore) now lives in
// ./credential-store-provider.ts, which decides between this file's
// EnvCredentialStore (Phase 1 bootstrap, still supported for local/dev use
// via AGENT_GATEWAY_CREDENTIAL_STORE=env) and db-credential-store.ts's
// DbCredentialStore (Phase 2 default). That indirection exists solely to
// avoid a circular import between this file and db-credential-store.ts —
// it introduces no additional behavior of its own.
