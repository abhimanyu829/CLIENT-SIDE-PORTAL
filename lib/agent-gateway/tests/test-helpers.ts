/**
 * lib/agent-gateway/tests/test-helpers.ts
 *
 * Shared test-only utilities. Not imported by any non-test module.
 */
import { __resetCredentialStoreForTests } from "../auth/credential-store-provider"
import { __resetGatewayConfigForTests } from "../config"

export function __resetCredentialStoreCacheForTests(): void {
  __resetCredentialStoreForTests()
  __resetGatewayConfigForTests()
}
