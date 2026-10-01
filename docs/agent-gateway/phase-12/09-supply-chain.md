# Phase 12 — 09 Supply chain and code integrity

## Pinned capability surface

`capabilities/manifest-summary.ts` reduces each core capability to its security-relevant attributes: id, version, status, exposure, operation type, adapter binding, input / output schema shape with bounds and strictness (`describeSchema`), content trust, required identity context, idempotency, async support and permission. Prose (name, description, classification text) is excluded. `manifestFingerprint` is the SHA-256 of the sorted summaries (`MANIFEST_SUMMARY_VERSION = 1`).

`capabilities/manifest.lock.json` stores the summary and fingerprint. A test fails when the live manifest differs, so any change to what agents can reach must update the lock in the same reviewed change. Phase 12 fingerprint: `4c11f2c9e31c33ea0724e891bad2b76cc7900cf4a3b559c0d31d5075dc948863`.

## Surface in force is evidence

`recordRegistryFingerprintOnce` runs from `withRequestTrace` (the shared request entry point) once per process and records `capability_registry.loaded` (category `CAPABILITY`, actor `SYSTEM`, full fingerprint in `inputDigest`, a 32-character prefix and the capability count in metadata) only when the fingerprint differs from the latest recorded one. A ledger outage never affects the request. Recording at registry creation was rejected (it could block test and startup paths on a real database).

## Dependencies

The packages the gateway introduced (`@modelcontextprotocol/sdk`, `@opentelemetry/api`, `cron-parser`) are exact-pinned in `package.json`, locked at the same version in `package-lock.json` (v2+), with `sha512` integrity. Every package any gateway module imports is a declared dependency (no phantom or transitive-only imports).

## Static scans of `lib/agent-gateway` (non-test sources)

- no `eval`, `new Function`, `child_process`, `vm`, `worker_threads` (the dangerous-primitive guard and policy-language modules, which name them to refuse them, are allowlisted);
- no dynamic `import()` / `require()` of a computed specifier;
- no `$queryRawUnsafe` / `$executeRawUnsafe` or untagged raw SQL; the only raw query is the tagged health probe;
- no `Math.random`, no `console.*`;
- `process.env` read only by the configuration modules;
- no `dangerouslySetInnerHTML` / `innerHTML` in the agent admin UI;
- adapters wired statically from reviewed `*-adapter` modules;
- every agent-facing and agent-admin API route declares `export const dynamic = "force-dynamic"` (P12-B4: three gateway routes lacked it).

## Proof

`p12-supply-chain.test.ts` (14).
