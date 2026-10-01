# Phase 14 — 10 Exit report

✅ done and verified · ⚠️ done with the stated limit · ⛔ deferred by plan

| Exit criterion | Status | Evidence |
|---|---|---|
| Agent simulation engine (scenario model, runner, driver interface) | ✅ | `simulation/*`, `01` |
| Platform invariants checked after every scenario, proven non-vacuous | ✅ | 9 invariants, seeded-violation tests (`p14-simulation` A3) |
| Adversarial test catalogue | ✅ | ADV-1..9 (`02`) |
| Red-team attack chains | ✅ | RT-1..5 (`03`) |
| Seeded fuzzing of every tool | ✅ | 15 tools × 24 cases (`04`) |
| Property tests of the security primitives | ✅ | 8 properties (`05`) |
| Security regression corpus | ✅ | 12 entries, append-only check (`06`) |
| Findings triaged; fixable ones fixed | ✅ | P14-F1 fixed; F2 / F3 documented (`07`) |
| No production / HTTP exposure of the engine | ✅ | environment guard + static tests |
| Regression | ✅ | 1376 / 1376 (102 files) + 9 / 9 integration |
| Typecheck / lint / build | ✅ | baseline / baseline (changed files 0) / pass |
| Live-LLM red team | ⚠️ | not run: worst-case agent behaviour is scripted (`03` limits) |

## 1. Architecture

A pure engine (scenarios as data, invariants over observations + world snapshots) behind a `SimulationDriver` interface; the single driver runs on the real gateway of the governance test kit. Nothing new on any request path except the P14-F1 fix.

## 2. Files changed

New: `lib/agent-gateway/simulation/{types,runner,invariants,world,scenarios,corpus,fuzzer,index}.ts`; `mcp/tool-errors.ts`; tests `simulation-test-driver.ts`, `p14-{simulation,adversarial,fuzz,property,findings}.test.ts`; docs `phase-14/01–10`.

Modified: `mcp/server.ts` (installs stable tool errors); `vitest.config.ts` (30 s timeouts); `tests/mcp-server-integration.test.ts` (stable not-found text).

## 3. Database changes

None.

## 4. APIs / services

No new route. Changed agent-visible behaviour: SDK-originated tool errors now read `INVALID_INPUT: The arguments do not match this tool's input schema.`, `CAPABILITY_NOT_FOUND: The requested tool is not available.` or `INTERNAL_ERROR: The tool call could not be completed.`

## 5. Workers

Unchanged (exercised by the scenarios through `drain`).

## 6. Tests

86 new (`08`).

## 7. Security

All nine invariants hold across 3 benign, 9 adversarial, 5 red-team scenarios, 12 corpus entries and 360 fuzz cases. One medium issue found and fixed (input reflection). Open low / info findings documented with recommendations.

## 8–11. Failures, bugs, pre-existing

`07`, `09`. Pre-existing carried: PRE-12-1, PRE-13-1..3, feedback-route TS error, ESLint baseline.

## 12. Out of scope

Live LLM red team; P14-F2 gate–adapter ownership pre-check (design change); load / performance testing.

## 13–16. Quality gates

Typecheck: baseline only. Lint: 122 (baseline); changed / new files 0. Build: pass (241). DB: no change.

## 17. Git diff

As in 2; `graphify-out/` regenerated; `.kiro/specs/` not committed.

## 18. Protected systems

Not changed. The cua contract was not used or extended.

## 19. Exit criteria

Met, with the live-LLM limitation stated.
