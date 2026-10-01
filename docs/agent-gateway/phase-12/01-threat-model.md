# Phase 12 — 01 Threat model

Scope: the agent platform (MCP / HTTP gateway, task engine and worker, triggers and webhooks, approvals, governance, ledger) and everything an AI agent can reach through it. Method: STRIDE per trust boundary. The boundaries are code (`lib/agent-gateway/security/trust-boundaries.ts`, `TB1`–`TB10`); `p12-threat-model.test.ts` fails if a cited module or test disappears or a document stops covering a boundary.

## Adversaries

| Id | Adversary | Capability |
|---|---|---|
| A1 | Prompt-injected agent | holds a valid credential, sends any syntactically valid call, any number of times |
| A2 | Hostile content author (vendor, customer) | writes text that later flows to an agent (product descriptions, ticket bodies, names) |
| A3 | Credential thief | holds a stolen or replayed bearer token / signature |
| A4 | External webhook sender | knows the endpoint, may know an old delivery |
| A5 | Rogue or compromised sub-admin | human session without SUPER_ADMIN |
| A6 | Supply-chain attacker | a malicious dependency release or an unreviewed manifest change |
| A7 | Network attacker | DNS control for an outbound host |

## Assets

Customer / vendor data (PII, orders, tickets), credentials (agent tokens, signing / webhook secrets, payment keys), money-moving operations, the human approver's attention, the audit evidence, platform availability.

## Threats and controls (STRIDE)

| STRIDE | Threat | Boundary | Primary control | Proven by |
|---|---|---|---|---|
| S | stolen / replayed agent credential | TB1 | hashed tokens, HMAC signatures, single-use nonces, live revocation | `authz-security`, `p12-tool-security` |
| S | forged webhook delivery | TB3 | HMAC over method, path, timestamp, nonce, event id, body | `p9-webhook` |
| T | tampered queue payload | TB9 | payload / input digests, live re-authorization | `p8-task-worker` |
| T | rewritten audit evidence | TB7 | append-only, hash-chained ledger (Phase 11) | `p11-ledger` |
| T | capability surface changed without review | TB7 | `manifest.lock.json` + fingerprint evidence | `p12-supply-chain` |
| R | agent denies an action | TB1, TB7 | every decision and execution in the ledger | `p11-ledger` |
| I | direct injection: agent sends hostile input | TB1, TB5 | strict schemas, input hygiene before the gate | `p12-injection` |
| I | indirect injection through stored content | TB2 | output schema, content notice, trust annotation, advisory signals | `p12-injection` |
| I | secrets in tool results | TB2, TB10 | fail-closed redaction in the resolver | `p12-exfiltration`, `p12-secrets` |
| I | cross-tenant read | TB6 | identity only from the verified context; owner scoping | `p12-isolation` |
| I | bulk extraction | TB2 | bounded list sizes, 256 KiB result cap | `p12-exfiltration` |
| I | secrets in logs, spans, metrics, ledger | TB10 | pino redaction, allowlisted attributes / labels, ledger scrubbing | `p12-secrets` |
| I | SSRF / DNS rebinding | TB8 | no agent-reachable outbound request; outbound guard for future use | `p12-ssrf` |
| D | flooding (calls, webhooks, evidence) | TB1, TB3 | rate limits, size limits, throttled evidence | `p12-tool-security`, `p11-failures` |
| E | agent triggers an operation that cannot execute (approval spam) | TB1 | executable-only tool surface | `p12-tool-security` |
| E | approver tricked by input text | TB5 | binding digest, step-up, display redaction, injection warning | `p12-injection` |
| E | sub-admin governs agents | TB4 | SUPER_ADMIN + live session; agent credentials refused | `p10-governance-access` |
| E | malicious dependency executes code | TB7 | exact pins, lockfile integrity, static scans | `p12-supply-chain` |

## Design stance on prompt injection

Prompt injection cannot be reliably detected, so no control depends on detection. The agent is assumed compromised (A1). Authorization (Phase 6), autonomy and human approval (Phase 7) are evaluated by the gate on every call, independent of what the model "believes". Detection only adds evidence and a warning, and never blocks (a false positive must not deny legitimate data, and a false negative must not matter).

## Residual risks

- A compromised agent can still perform everything its connection is authorized for at its autonomy level. Mitigation is scope (least-privilege connections) and approvals, not detection.
- The detector misses novel phrasings (by design it is advisory).
- Content-trust is declared per capability. A capability wrongly declared `SYSTEM_GENERATED` loses the content notice; the declaration is pinned by the manifest lock and reviewed.
- A superuser with direct DB access can rewrite the ledger chain (Phase 11, `02-integrity-model`).
- The human product route `/api/products/[slug]` returns non-published products (pre-existing, out of the agent surface, `11-bug-report`).
