/**
 * lib/agent-gateway/auth/credential-store-provider.ts
 *
 * Single place that decides WHICH CredentialStore implementation is
 * active. Defaults to the Phase 2 DB-backed store; can be forced back to
 * the Phase 1 env-JSON bootstrap store via
 * AGENT_GATEWAY_CREDENTIAL_STORE=env (useful for local development
 * without a database, or for isolated Phase-1-style testing).
 *
 * All authenticators (bearer-authenticator.ts, signature-verifier.ts,
 * signed-request-authenticator.ts) import getCredentialStore from THIS
 * module now, not from credential-store.ts directly — this is the only
 * change required anywhere in Phase 1's auth code to complete the
 * "swap EnvCredentialStore for a DB-backed store, no caller changes"
 * migration promised in Phase 1's architecture doc.
 */
import type { CredentialStore } from "./credential-store"
import { EnvCredentialStore } from "./credential-store"
import { createDbCredentialStore } from "./db-credential-store"

let storeSingleton: CredentialStore | null = null

export function getCredentialStore(): CredentialStore {
  if (!storeSingleton) {
    storeSingleton = process.env.AGENT_GATEWAY_CREDENTIAL_STORE === "env" ? new EnvCredentialStore() : createDbCredentialStore()
  }
  return storeSingleton
}

/** Test-only: inject a fake store. */
export function __setCredentialStoreForTests(store: CredentialStore | null): void {
  storeSingleton = store
}

/** Test-only: clears the singleton so the next getCredentialStore() re-reads env. */
export function __resetCredentialStoreForTests(): void {
  storeSingleton = null
}
