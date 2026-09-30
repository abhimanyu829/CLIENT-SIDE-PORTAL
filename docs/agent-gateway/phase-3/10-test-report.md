# Phase 3 — Test Report

## Summary

| Category | File | Tests | Result |
|---|---|---|---|
| Unit — id/versioning | `capability-id.test.ts` | 13 | All pass |
| Unit — dangerous-primitive guard | `dangerous-primitive-guard.test.ts` | 9 | All pass |
| Unit — schema validation | `capability-schema-validation.test.ts` | 6 | All pass |
| Unit — registry core | `capability-registry.test.ts` | 41 | All pass |
| Integration — manifest + Phase 2 identity | `capability-manifest.test.ts` | 12 | All pass |
| Failure — fail-closed behavior | `capability-failure.test.ts` | 9 | All pass |
| Security — injection/enumeration/mutation | `capability-security.test.ts` | 18 | All pass |
| **Phase 3 total** | 7 files | **108** | **All pass** |
| Phase 1 + Phase 2 regression | 17 pre-existing files | 127 | All pass, zero change |
| **Grand total** | **24 files** | **235** | **All pass** |

Run: `npx vitest run` (full suite), confirmed multiple times across the bug-fix cycle described in `11-bug-report.md`.

## Unit tests — mapped to the spec's 28-item checklist

| # | Spec item | Test(s) |
|---|---|---|
| 1 | Valid capability registration | `capability-registry.test.ts` #1 |
| 2 | Duplicate capability rejection | `capability-registry.test.ts` #2 |
| 3 | Duplicate version rejection | `capability-registry.test.ts` #2 (same `(id,version)`); #3 confirms a DIFFERENT version is allowed |
| 4 | Invalid capability ID rejection | `capability-registry.test.ts` #4 |
| 5 | Invalid risk tier rejection | `capability-registry.test.ts` #5, #5b (exposure) |
| 6 | Missing input schema rejection | `capability-registry.test.ts` #6 |
| 7 | Malformed schema rejection | `capability-registry.test.ts` #7 (dangerous adapter key), #22 (malformed adapter key shape) |
| 8 | Valid schema acceptance | `capability-registry.test.ts` #8 |
| 9 | Input validation success | `capability-registry.test.ts` #9 |
| 10 | Input validation failure | `capability-registry.test.ts` #10 |
| 11 | Unknown-field handling | `capability-registry.test.ts` #11; `capability-schema-validation.test.ts` (strict-schema tests) |
| 12 | Output schema validation | `capability-registry.test.ts` #12 |
| 13 | Capability lookup | `capability-registry.test.ts` #13 |
| 14 | Missing capability lookup | `capability-registry.test.ts` #14 |
| 15 | Version resolution | `capability-registry.test.ts` #15 |
| 16 | Deprecated capability handling | `capability-registry.test.ts` #16, #16b |
| 17 | Disabled capability handling | `capability-registry.test.ts` #17, #17b |
| 18 | Forbidden capability rejection | `capability-registry.test.ts` #18 |
| 19 | Deterministic registry ordering | `capability-registry.test.ts` #19 |
| 20 | Immutable registry behavior | `capability-registry.test.ts` #20, #20b |
| 21 | Dangerous execution reference rejection | `capability-registry.test.ts` #21; `dangerous-primitive-guard.test.ts` (full suite) |
| 22 | Missing execution mapping rejection (malformed adapterKey) | `capability-registry.test.ts` #22 |
| 23 | Incorrect permission metadata rejection | `capability-registry.test.ts` #24 (documents the null+note pattern; TS boundary rejects genuinely wrong types) |
| 24 | Side-effect metadata integrity | `capability-registry.test.ts` #25 |
| 25 | Idempotency metadata integrity | `capability-registry.test.ts` #26 |
| 26 | Async metadata integrity | `capability-registry.test.ts` #27 |
| 27 | Resource metadata integrity | `capability-registry.test.ts` (resource metadata test) |
| 28 | Error contract integrity | `capability-registry.test.ts` #28 |

(Item 22 in the spec's numbering, "missing execution mapping rejection," is interpreted here as "a malformed/invalid execution mapping is rejected" — a capability with NO execution mapping at all (`executionReference: null`) is explicitly VALID and tested separately as "missing execution mapping is representable... without breaking resolve()", since Phase 3 must support capabilities awaiting Phase 4 adapter wiring.)

## Integration tests

- `registerCoreCapabilities()` loads the real manifest into a fresh registry without throwing.
- Every entry in `CORE_CAPABILITY_MANIFEST` is actually registered exactly once.
- The manifest represents at least one capability from every Phase 0 risk tier.
- No CRITICAL capability is ever `AGENT_AVAILABLE`/`PUBLIC_DISCOVERABLE`.
- No `HIGH_RISK_MUTATION` capability with `exposure: INTERNAL_ONLY` carries a live `executionReference`.
- No `FORBIDDEN` capability carries any `executionReference`.
- Registering the same manifest into two independent registry instances produces identical, non-interfering results.
- The singleton (`getCapabilityRegistry()`) returns the same instance across calls, comes pre-loaded, and resets cleanly via `__resetCapabilityRegistryForTests()`.
- **Phase 2 identity integration**: every registered capability's `requiredIdentityContext` fields are all satisfiable by a real `AgentMachineIdentity` shape (`connectionId`, `ownerId`, `teamId`) — verified structurally against the actual Phase 2 type, not a mock.
- **Capability lookup -> schema validation -> valid result, no business execution**: confirmed by calling `validateInput()` on a real manifest capability and asserting only the validated value is returned — no adapter, database, or service is touched.

## Failure tests (fail-closed)

All 9 pass, confirming: a single malformed `register()` call never partially populates the registry; a manifest loop that fails partway through leaves prior successful registrations intact but the loop itself still throws (documented as the reason `registerCoreCapabilities()` must only run at trusted app-init time); duplicate definitions are rejected, not overwritten; missing version is rejected, not defaulted to 1; an unrelated capability remains resolvable even if a different one failed to register; unknown/incompatible version lookups fail closed with the correct code, never a silent fallback; disabling every version of a capability makes it fully (not partially) unresolvable.

## Security tests

All 18 pass, confirming: path traversal, arbitrary function-name/route-shaped, SQL-like, oversized, and malformed-version capability references are all rejected by `resolve()`; deeply nested/oversized/`__proto__`-bearing/array-shaped/null input is rejected by `validateInput()`; a resolved definition's nested metadata cannot be mutated post-registration; a caller cannot bypass `CONFLICT` to overwrite an existing definition with forged/escalated permission metadata; `list()`'s returned array is a fresh copy each call (pushing to it does not affect the registry); FORBIDDEN and DISABLED capabilities are excluded from default discovery, and neither's discoverability nor knowledge of its exact id grants any further access; the pre-populated singleton registry contains zero dangerous adapter keys.

## Regression tests

Full Phase 1 + Phase 2 suite (127 tests, 17 files) re-run after every Phase 3 change and confirmed unaffected. `npx tsc --noEmit` produces only the one pre-existing, out-of-scope error (`app/api/feedback/route.ts:128`). `npx eslint . --ext .ts,.tsx` produces exactly 122 problems — identical to the Phase 1/Phase 2 baseline, zero new issues, zero hits under `lib/agent-gateway/capabilities/`. `npm run build` (Next.js 16.2.6, Turbopack) completes successfully — 250 static routes compiled, all standard build manifests present, no build errors.
