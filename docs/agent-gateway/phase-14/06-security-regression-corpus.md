# Phase 14 — 06 Security regression corpus

`simulation/corpus.ts` holds one scenario per security bug or finding fixed in Phases 4–13 that is expressible through the agent surface. Entries are append-only: `p14-adversarial` F asserts the known ids are still present, unique and referenced, and runs each entry with all invariants.

| Id | Guards |
|---|---|
| REG-P4-1 | `tickets.list` never takes the human route's admin branch |
| REG-P4-2 | not-owned subscription is `RESOURCE_NOT_FOUND` |
| REG-P5-1 | tool names are capability ids (no `@v1` / path aliases) |
| REG-P8-1 | tasks are bound to the submitting connection |
| REG-P12-B1 | credential-shaped ids are never echoed |
| REG-P12-B2 | described-only capabilities are not tools |
| REG-P12-B3 | drafts are not in the agent catalogue |
| REG-P12-E | a token planted in stored data never reaches the agent |
| REG-P12-B4 | hostile input never creates an approval or a write |
| REG-P13-B1 | keyed writes without a key are refused before any approval |
| REG-P13-B2 | `recovery.` keys are refused on both paths |
| REG-P13-E | internal staff notes never leave `tickets.get` |

P14-F1 is guarded by `p14-findings` and by every fuzz batch (I2, I3). Bugs not expressible as agent steps (ledger tampering, recovery forward links, breaker thresholds, governance access) keep their phase suites as regression tests.
