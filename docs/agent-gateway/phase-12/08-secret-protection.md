# Phase 12 — 08 Secret protection

## One definition of "credential-shaped"

`security/secret-patterns.ts` (`scrubSecrets`, `containsSecret`, replacement `[redacted]`) is used by both the audit ledger's metadata redaction (Phase 11) and the agent output guard (Phase 12), so they cannot drift. Kinds: `GATEWAY_TOKEN` (`agw_…`), `JWT`, `PRIVATE_KEY` (PEM, including an unterminated block), `STRIPE_KEY`, `RAZORPAY_KEY`, `WEBHOOK_SECRET` (`whsec_…`), `AWS_ACCESS_KEY`, `GITHUB_TOKEN`, `SLACK_TOKEN`, `URL_CREDENTIALS` (`scheme://user:pass@`), `LONG_HEX` (40+ hex: raw signing secrets, keys, digests). No identifier shown to agents reaches 40 hex characters (cuids; `apr_` / `atk_` / `trg_` refs are 32 hex), so the generic rule does not damage legitimate output. Consequence: a 64-hex value in ledger metadata is scrubbed, so full fingerprints are recorded in `inputDigest`, not metadata.

## Where secrets can go, and what stops them

| Sink | Control |
|---|---|
| Tool results | fail-closed redaction in `AdapterResolver` (`06-data-exfiltration`) |
| Ledger | metadata key allowlist + `scrubSecrets` + shape checks (Phase 11) |
| Logs | `gatewayLogger` = `@/lib/logger` child with pino `redact` for `authorization`, `cookie`, `token`, `bearerToken`, `accessToken`, `refreshToken`, `secret`, `webhookSecret`, `signingSecret`, `clientSecret`, `password`, `apiKey`, `signature`, `otp`, `stepUpCode`, `code`, `rawBody`, `body`, `input`, `output`, `result`, `payload` (top level and one level down), plus the signature / API-key / authorization / cookie headers |
| Spans | allowlisted attributes only (Phase 11) |
| Metrics | closed label vocabularies (Phase 11) |
| Approval display | key-based redaction + secret-shaped value scrubbing, resource id included |
| Governance views | agent-supplied resource ids scrubbed (`agentStr`) |
| Errors | stable codes; internal messages never returned |

## At rest

Agent bearer tokens: stored as hashes only. HMAC signing secrets and webhook secrets: encrypted (`shared/crypto.ts`, `ENCRYPTION_KEY`); shown once on creation. Step-up codes: hashed. Approval binding: digest only. Environment variables are read only by the configuration modules (static scan, `09-supply-chain`).

## Proof

`p12-secrets.test.ts`: (G1) the gateway logger redacts every sensitive key at the top level, one level down and in header bags; (G2–G3) bearer tokens are stored as SHA-256 hashes, signing and webhook secrets only encrypted; a flow through the real MCP route handler with the DB credential store (valid bearer call, forged token refused with 401, an approval with step-up) leaves no token, forged token, signing secret, webhook secret or step-up code in any log line, span, metric, response or stored table (ledger, AuditLog, connections, credentials, approvals, decisions, tasks, triggers, trigger runs). Plus the redaction cases in `p12-exfiltration` and `p11-ledger`.
