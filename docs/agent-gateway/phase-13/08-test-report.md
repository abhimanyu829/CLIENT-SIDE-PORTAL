# Phase 13 — 08 Test report

## New suites

| Suite | Tests | Covers |
|---|---|---|
| `p13-domain-capabilities` | 11 | capability map vs registries (both directions, five domains); the eight new capabilities: registration, adapter binding, async support, closed schemas, identity fields refused, owner scoping, explicit content trust, clean metadata, write tiers / permissions / idempotency / recovery spec, reads side-effect free |
| `p13-domains` | 13 | products.listMine, campaigns.getActive, subscriptions.list, tickets.get, analytics.summary, analytics.productPerformance end to end through MCP, Phase 6 / 7, resolver and content guard; isolation, exclusions, bounds, refusals; reads denied without policy |
| `p13-support-writes` | 13 | tickets.create sync (owner, defaults, audit intent order, recovery input), key required / malformed / reserved, forbidden fields, hostile vs instruction-like text, ASSISTED approval exactly once, denied without policy / autonomy, ledger outage; task-path durable idempotency; tickets.close owner-only, idempotent, no staff transitions; recovery exactly once as the original connection and refused when autonomy was lowered |
| **Total** | **37** | |

## Updated existing tests (legitimate surface change, no assertion weakened)

- `p8-task-primitives`: retry classes and async-capable list now include the eight new capabilities; added the assertion that async support is never declared without an adapter binding.
- `p12-tool-security`: the exact tool list now includes the new tools; contract-only capabilities are still asserted hidden.
- `execution-data-integrity`: the fake now has ticket write methods (for the new writes); the test now executes the four Phase 4 READ adapters and asserts the write methods were never called (stronger than "the method does not exist").

## Regression

Full suite 1290 / 1290 (97 files); integration and gates in `10-phase-13-exit.md`.

## Not covered

Real Postgres (the in-memory fake implements the Prisma subset the adapters use: equality, `in`, `gte` / `lte`, ordering, `take`); Redis-backed sync replay (Redis is absent in unit tests; the durable task-path dedupe is tested instead).
