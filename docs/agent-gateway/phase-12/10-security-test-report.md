# Phase 12 — 10 Security test report

## New suites

| Suite | Tests | Covers |
|---|---|---|
| `p12-threat-model` | 6 | trust boundaries as code: ids, completeness, modules and tests exist, docs cover every boundary |
| `p12-injection` | 48 | detector corpus and obfuscation, MCP / task annotations, evidence without content, nothing injected text asks for is reachable, input hygiene before the gate, approver protection |
| `p12-tool-security` | 8 | executable-only surface, call-time re-check, closed schemas, unknown arguments refused, clean static metadata, annotations |
| `p12-exfiltration` | 11 | redaction on sync / list / task / stored results, fail-closed guard, withheld result as `INTERNAL_ERROR`, field allowlisting, error detail, published catalog only, bounded bulk reads |
| `p12-isolation` | 5 | 40 interleaved concurrent calls across two tenants, identity never from arguments, trace scopes never bleed, task / approval ownership, instruction vs data channels |
| `p12-ssrf` | 67 | URL payload table, address classification table, connect-time DNS checks and rebinding, transport (no redirects, size cap, timeout, header allowlist), no agent-reachable outbound request |
| `p12-secrets` | 2 | log redaction; secrets at rest; a real authenticated flow leaks no secret into logs, spans, metrics, responses or any table |
| `p12-supply-chain` | 14 | pinned surface + fingerprint evidence, dependency pins and integrity, static code scans, dynamic routes |
| **Total** | **161** | |

## Security invariants covered (Phase 12 subset of the master list)

| Invariant | Evidence |
|---|---|
| Agent identity only from the verified credential | `p12-isolation`, `authz-security` |
| No capability outside the executable, agent-available surface | `p12-tool-security` |
| Every call passes Phase 6 / Phase 7 regardless of content | `p12-injection` B2–B3 |
| Third-party text is labelled data, never instructions | `p12-injection`, `p12-isolation` |
| No secret in any agent-visible output, log, span, metric or ledger row | `p12-exfiltration`, `p12-secrets` |
| Output guard fails closed | `p12-exfiltration` |
| No tenant can see another tenant's data, tasks or approvals | `p12-isolation` |
| No agent-reachable outbound request; outbound guard refuses internal targets | `p12-ssrf` |
| Capability surface changes are reviewed and evidenced | `p12-supply-chain` |
| Approver sees redacted, warned input | `p12-injection` B5 |

## Regression

Earlier suites changed: `mcp-server-integration.test.ts`, `p7-end-to-end.test.ts` (register the adapters they exercise, per the executable-only rule). No assertion was weakened. Full-suite, typecheck, lint, build and integration results: `12-phase-12-exit.md`.

## Not covered by automated tests

A real LLM following injected content (the platform's security does not depend on the model's behaviour; the hijacked-agent tests act as the model). Real DNS and TLS against the internet (the guard is tested with injected resolvers and transports; it is not used by any capability).
