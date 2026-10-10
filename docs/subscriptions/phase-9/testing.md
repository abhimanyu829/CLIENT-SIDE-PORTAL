# Testing — Phase 9

## Executed (actual results)

| Command | Result |
|---|---|
| `npx vitest run lib/agent-gateway/tests/p16-subscription-governance.test.ts` | **14/14 PASS** |
| `npx vitest run lib/agent-gateway` | 40 failed / 1487 passed (110 files) — identical to the pre-existing baseline; Phase 9 adds zero gateway failures |
| `npm run test:subscriptions` | 95/95 |
| `npm run test:plans` | 84/84 (+1 skipped) |
| `npm run test:entitlements` | 88/88 (+1 skipped) |
| `npm run test:razorpay` | 87/87 (+2 skipped) |
| `npm run test:provisioning` | 73/73 |
| `npm run test:freetrial` | 70/70 |
| `npm run type-check` | 0 Phase-9 errors; 3 pre-existing gateway errors |
| `npx eslint <phase-9 files>` | clean |
| `npm run build` | Compiled successfully |

## Coverage (p16, 14 tests)

- Manifest: 8 capabilities registered; READ vs HIGH_RISK_MUTATION
  classification; owner-context requirement; strict schema rejection of
  forged/privileged fields (`userId`, `confirmed`, `price`).
- Adapters: catalog trimming; owner-scoped summary; cross-customer empty view;
  resolver-backed access; verified trial expiry; billing list; free/trial
  delegation args; cancel owner-only (+ cross-tenant denied before provider);
  approval preflight; unknown-resource denial.

## Capability-surface sync (completed in this change)

The Phase-9 surface change is accompanied by the reviewed updates the repo's
supply-chain rule requires:

- `manifest.lock.json` regenerated from the live manifest via the new
  deterministic tooling `scripts/refresh-manifest-lock.ts` (same pure functions
  the p12 test uses; `--check` mode for CI). p12 H1/H2/H4 now pass.
- Adapter modules renamed to the static-wiring convention
  (`subscriptions-read-adapter.ts`, `subscriptions-mutation-adapter.ts`).
- `p14-fuzz.test.ts` base-tool fixture synced to the live tool surface
  (legacy products.* + Phase-9 tools); fuzz suite 27/27 green.

After the sync the full gateway run returned EXACTLY the pre-existing 40
failures / 16 files (env-dependent / legacy scenario fixtures: p15 released-
tools set, mcp-route-handler, execution-security, adapter-resolver,
p14 ADV-4 / REG-P12-B2 whose pin still predates the products.* mutation
capabilities). Baseline comparison by stash proved those are pre-existing,
not introduced by Phase 9.

## Not run (disclosed)

- Live MCP round-trip against a real agents runtime (requires the gateway's
  Redis + credential environment; gateway suite covers this path in-suite and
  remains partially red from pre-existing env-dependent tests).
- Live Razorpay TEST round-trip (Phase-4 credential blocker, deferred per
  user).
