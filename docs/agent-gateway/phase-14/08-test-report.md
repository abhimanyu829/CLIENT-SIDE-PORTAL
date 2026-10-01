# Phase 14 — 08 Test report

| Suite | Tests | Covers |
|---|---|---|
| `p14-simulation` | 26 | environment guard (incl. before the driver), no HTTP surface, engine purity, PRNG / fuzzer determinism and strategy coverage, `$ref` resolution, error-code parsing; each of the nine invariants fires on a seeded violation (12 cases) and stays silent on clean evidence; benign scenarios BEN-1..3 on the real gateway with effect checks |
| `p14-adversarial` | 33 | ADV-1..9 + effect checks; RT-1..5 + effect checks; corpus integrity + 12 corpus entries |
| `p14-fuzz` | 16 | tool-surface equality + 15 tools × 24 seeded cases with output-contract and invariant oracles |
| `p14-property` | 8 | properties of the security primitives (`05`) |
| `p14-findings` | 3 | P14-F1 mapping and end-to-end non-reflection; valid calls unaffected |
| **Total** | **86** | |

Updated existing test: `mcp-server-integration` (unknown tool now returns the stable `CAPABILITY_NOT_FOUND` text instead of the SDK's reflecting message — a stricter assertion).

Regression: full suite 1376 / 1376 (102 files); integration and gates in `10-phase-14-exit.md`.

Not covered: live LLM agents; real Postgres / Redis under the simulation (in-memory datastores with the real gateway code).
