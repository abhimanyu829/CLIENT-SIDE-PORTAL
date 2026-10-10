# Testing (Phase 10)

## Executed (actual results)

| Command | Result |
|---|---|
| `npm run test:reconciliation` | **24/24 PASS** (rules 11, engine 13) |
| `npm run test:subscriptions` | 95/95 |
| `npm run test:plans` | 84/84 (+1 skipped) |
| `npm run test:entitlements` | 88/88 (+1 skipped) |
| `npm run test:razorpay` | 87/87 (+2 skipped) |
| `npm run test:provisioning` | 73/73 |
| `npm run test:freetrial` | 70/70 |
| `npx vitest run lib/agent-gateway` | 40 failed / 1487 passed — EXACT pre-existing baseline (Phase 10 adds zero) |
| `npm run type-check` | 0 Phase-10 errors; 3 pre-existing gateway adapter errors |
| `npx eslint <phase-10 files>` | clean |
| `npm run build` | Compiled successfully (2.6min) |
| Migration apply | **BLOCKED — Supabase `P1001` unreachable (5 attempts)**; SQL written + `prisma validate` passes; re-run `npx prisma migrate deploy` when DB returns |

## Coverage

- **Rules (11):** FAILED/stale-PENDING events (no premature classification),
  processed-events no-finding, duplicate payment CRITICAL, FAILED charge,
  exact-integer amount rules, stale pending activation window, period-past-end,
  retryable vs permanent provisioning (evidence carries `periodRef`),
  source-isolation (standalone never scanned; ended-source grant CRITICAL),
  trial expiry, threshold + findingKey determinism.
- **Engine (13):** DETECT_ONLY zero mutations; DRY_RUN proposes only;
  SAFE_AUTO_REPAIR calls BOTH idempotent services + postcondition `VERIFIED`;
  MANUAL escalates without calls; provider-unavailable recorded honestly;
  repeated-run finding upsert (no duplicates); RESOLVED reopens; active-run
  guard; stale-run takeover; manual repair verification; unsafe-finding
  escalation (no fabricated repair); unknown id fails; allow-list content pinned.

## Not run (disclosed)

- Live reconciliation run against production DB (blocked by Supabase outage —
  migration not yet applied; see below).
- Real provider settlement comparison (no verified settlement data source).
- Restore drill (see backup-and-recovery.md).