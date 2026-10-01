# Phase 12 — 06 Data exfiltration

## Controls, in order, in `AdapterResolver`

1. Output schema (Phase 4): only allowlisted fields leave an adapter; extra fields an adapter returns are stripped.
2. Secret redaction (`security/secret-patterns.ts`, shared with the ledger's metadata redaction): every string is scrubbed of gateway tokens, JWTs, private keys, Stripe / Razorpay keys, webhook secrets, AWS access keys, GitHub / Slack tokens, credentials in URLs and 40+ hex strings, replaced with `[redacted]`.
3. Fail closed: if scrubbing throws, or the redacted value no longer satisfies the output schema, the result is withheld (`REDACTION_FAILED`, `REDACTED_OUTPUT_INVALID`).
4. Size bound: results above 256 KiB are withheld (`OUTPUT_TOO_LARGE`); unserialisable results too (`NOT_SERIALIZABLE`).
5. Injection signals (advisory; a detector failure only loses signals).

A withheld result reaches the agent as a stable `INTERNAL_ERROR` with no data; the reason is ledger evidence as the `detailCode` of the `execution.failed` event, and it is counted in `agent_content_findings_total{kind="OUTPUT_WITHHELD"}`. The guard also runs on idempotency replays and on stored task results when read back, so rows written before Phase 12 are scrubbed too (task status `resultUnavailable: "WITHHELD"` when withheld).

## Other channels

- Error detail: internal error messages never reach the agent (stable codes only).
- Catalog scope: `products.get` serves AVAILABLE products only; drafts and archived products are indistinguishable from missing ones (P12-B3).
- Bulk reads: bounded by the existing services' page caps plus the 256 KiB result bound.
- Network: no agent-reachable outbound request exists (`07-ssrf`); markdown image beacons in content are flagged (`DATA_EXFILTRATION`).
- Evidence: ledger events record field paths, kinds and counts, never the values.

## Proof

`p12-exfiltration.test.ts` (11): sync MCP call scrubs structured content and the text block; list items scrubbed; task path scrubbed at store and on read-back of a pre-Phase-12 row; fail-closed cases (schema-breaking redaction, failing scrubber, oversized, unserialisable); resolver withholding is an `INTERNAL_ERROR` with the reason only in evidence; extra adapter fields cannot leak; internal error detail never reaches the agent; published catalog only; bounded bulk reads.
