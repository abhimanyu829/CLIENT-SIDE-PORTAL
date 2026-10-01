# Phase 11 — 02 Integrity model

## Chain

One global chain over all events:

```
eventDigest = SHA-256( "abhibhi.audit.v1" "\n" previousEventDigest "\n" canonicalJson(body) )
```

- `body` = every stored field except the row id, `recordedAt` (database clock) and `eventDigest` itself — including `sequence`, `eventId` and `schemaVersion` (`digest.ts#canonicalEventBody`).
- `canonicalJson` = the Phase 7 RFC 8785 serializer: key order is irrelevant, so Postgres `jsonb` key reordering cannot break verification.
- The first event links to `GENESIS_DIGEST` (64 zeros).
- The domain tag versions the scheme; `schemaVersion` versions the event shape. An unknown schema version is reported, never trusted.

## What it detects (verified by `p11-ledger.test.ts`)

| Attack | Result of `verifyAuditChain()` |
|---|---|
| Edit any field of an event | `DIGEST_MISMATCH` at that event |
| Edit and recompute that event's digest | `BROKEN_LINK` at the next event |
| Forge `previousEventDigest` (and recompute) | `BROKEN_LINK` at that event |
| Delete an event | `SEQUENCE_GAP` |
| Reorder / substitute bodies | `BROKEN_LINK` / `DIGEST_MISMATCH` at the first moved event |
| Replay a copy | refused by the unique `sequence` / `eventId` / `eventDigest` constraints; if smuggled past them, `DUPLICATE_EVENT_ID` |
| Unknown schema | `UNKNOWN_SCHEMA` |
| Unreadable store | throws `AUDIT_LEDGER_UNAVAILABLE` (an unverifiable chain is never "ok") |

Verification is batched (≤1 000 rows per read), bounded (`maxEvents`, default 50 000, reported as `truncated`) and can start at any sequence by anchoring on its predecessor's digest.

## Append-only, three layers

1. **Application** — `ledger.ts` is the only module that touches `AgentAuditEvent`; it has no update or delete path; the index exports none (test: no exported name matches update/delete/remove/edit/rewrite/truncate/purge; no file under `lib/` or `app/` calls `agentAuditEvent.update|updateMany|delete|deleteMany|upsert` or issues UPDATE / DELETE / TRUNCATE SQL on it).
2. **Database** — the migration installs `agent_audit_event_append_only()` and two triggers: `BEFORE UPDATE OR DELETE … FOR EACH ROW` and `BEFORE TRUNCATE … FOR EACH STATEMENT`, both raising `insufficient_privilege`. This applies to every role that does not own / cannot drop the trigger, including the application's.
3. **Chain** — anything that gets past 1 and 2 is detected by verification (above).

## Concurrency

Appends are serialized within a process. Across processes, two appenders that read the same head collide on the unique `sequence` (P2002); the loser re-reads the head and re-links (up to 8 attempts, then `AUDIT_LEDGER_UNAVAILABLE`). Tested: 50 concurrent appends yield a gap-free verifiable chain; a simulated competing process is linked correctly.

## Evidence used for recovery

Before a recovery uses a recorded execution, `RecoveryService` re-checks that event: its own digest, its link to its predecessor, **and its successor's link to it** (an edited event with a recomputed digest still breaks the next link). The newest event has no successor yet; rewriting it requires bypassing the database trigger and is caught by chain verification against the external anchor. See `07-recovery.md`.

## Residual risk (stated, not hidden)

A database superuser can drop the trigger and rewrite the entire chain with recomputed digests; the chain alone cannot detect a wholesale rewrite. Mitigation: every verification logs the head sequence and head digest (`agent_gateway_audit_chain_verified`) to the log pipeline / Sentry — an external anchor a rewritten chain no longer matches. A keyed (HMAC) chain was considered and rejected for this phase: it would couple the evidence to `ENCRYPTION_KEY` rotation and still not resist a superuser who also holds the application's secrets. Periodic external checkpointing (e.g. head digest to WORM storage) is the recommended follow-up.

Not verified here: the migration has not been applied to a live Postgres in this environment (deferred with all migrations until after Phase 15, per the owner); the trigger SQL is asserted structurally.
