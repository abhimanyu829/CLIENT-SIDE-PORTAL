# Phase 14 — 01 Simulation engine

`lib/agent-gateway/simulation/` simulates agents (and the human operator steps they depend on) against the real gateway and checks platform invariants after every scenario.

## Parts

| File | Role |
|---|---|
| `types.ts` | scenario model: `Scenario { id, title, category, reference?, steps }`; steps `tool`, `task_submit`, `drain`, `approve_latest`, `list_tools`; per-step expectations (`ok`, `error[code]`, `approval_required`, `any`); `Observation`, `WorldSnapshot`, `SimulationDriver` |
| `runner.ts` | `runScenario(scenario, driver, { environment, invariants })`: environment guard, `$ref:<label>.<field>` step references, expectation checks, invariants |
| `invariants.ts` | the nine platform invariants (below), pure |
| `world.ts` | `SIM_WORLD`: two tenants, private markers, planted secret and injection, published / draft products, per-connection autonomy |
| `scenarios.ts` | benign, adversarial and red-team catalogues |
| `corpus.ts` | security regression corpus |
| `fuzzer.ts` | seeded PRNG (mulberry32) and hostile-argument generator |

The engine never talks to the gateway itself. A `SimulationDriver` executes steps; the only driver (`tests/simulation-test-driver.ts`) runs them on the governance test kit, i.e. the real MCP server, input hygiene, Phase 6 policy engine, Phase 7 gate and approvals (real step-up decision flow; only SMS delivery is mocked), Phase 8 engine and worker, Phase 4 resolver and adapters, Phase 11 ledger and Phase 12 content guard, over in-memory datastores.

## Invariants (checked after every scenario, fuzz batch and corpus entry)

| Id | Statement | Evidence used |
|---|---|---|
| I1 NO_CROSS_TENANT_LEAK | an agent never observes another owner's private markers (or staff-only notes) | observations, world markers |
| I2 NO_SECRET_LEAK | nothing credential-shaped reaches an agent | everything the agent received |
| I3 STABLE_ERRORS | errors are `CODE: message`, never internals or stack traces | error texts |
| I4 NO_UNAUDITED_WRITE | every write effect is matched by an audited write; every success had an `execution.started` intent | world effects, ledger |
| I5 NO_UNAUTHORIZED_WRITE | every execution intent follows a gate grant (`authorization.allowed`, `approval.consumed`, `recovery.executing`) for the same request | ledger |
| I6 OWNER_ONLY_WRITES | every effect belongs to an owner whose connection executed a write | world effects, ledger |
| I7 NEVER_EXECUTABLE | described-only / internal / forbidden capabilities never produce an execution event | ledger |
| I8 APPROVAL_SINGLE_USE | no approval is consumed twice | ledger (`approval.consumed` by ref) |
| I9 LEDGER_INTEGRITY | the hash chain verifies | `verifyAuditChain` |

Invariants are judged on effects (rows created or changed, ledger events), not on the gateway's own return values, so a control that silently stops working is caught by what it let happen. Each invariant has a seeded-violation test proving it is not vacuous (`p14-simulation` A3).

## Guard rails

- Environment: `development` and `staging` only; anything else (including `production`) throws before the driver is touched.
- No HTTP surface: no route, page, component, worker or gateway module imports the engine (static test).
- Pure: no datastore, network, filesystem, environment, clock or `Math.random` access inside the engine (static test).
- Deterministic: same seed, same cases; a fuzz failure reports `(seed, tool, index, strategy)`.
