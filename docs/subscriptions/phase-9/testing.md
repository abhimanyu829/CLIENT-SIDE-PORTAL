# Testing — Phase 9

## Executed (actual results)

| Command | Result |
|---|---|
| `npx vitest run lib/agent-gateway/tests/p16-subscription-governance.test.ts` | **14/14 PASS** |
| `npx vitest run lib/agent-gateway` | 44 failed / 1472 passed (110 files) |
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

## Gateway surface-pin deltas (transparent, not hidden)

Full gateway run: 44 failures vs the pre-existing 40 baseline. The +4 are the
known manifest-lock/surface-pin class (p12 H1/H2/H4, p14 fuzz/REG-P12-B2,
p15 tool-set) since capability-surface changes must be accompanied by a
reviewed `manifest.lock.json` refresh — no regeneration tooling exists in the
repo, and hand-rewriting a ~1000-line reviewed pin is unsafe. Baseline
comparison (stash) proved mcp-route-handler/execution-security/
adapter-resolver failures are pre-existing. Documented, not suppressed.

## Not run (disclosed)

- Live MCP round-trip against a real agents runtime (requires the gateway's
  Redis + credential environment; gateway suite covers this path in-suite and
  remains partially red from pre-existing env-dependent tests).
- Live Razorpay TEST round-trip (Phase-4 credential blocker, deferred per
  user).