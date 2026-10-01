# Phase 11 — 10 Bug report

## Found and fixed during Phase 11

| ID | Severity | Bug | Fix | Proof |
|---|---|---|---|---|
| P11-B1 | High | Recovery trusted an event whose own digest and back-link were consistent. An event edited **and re-digested** (keeping `previousEventDigest`) passed, so a tampered `recoveryInput` could redirect a compensation to another resource. | `assertEvidenceIntact` also checks the successor's link to the event. | `p11-recovery`: "a re-digested forgery that keeps its own back-link is caught by its successor's link" (decoy resource untouched). |
| P11-B2 | High | The worker classified every resolver error as post-dispatch. Phase 11's new pre-dispatch refusals (ledger intent, open breaker) would therefore permanently fail queued non-idempotent writes that provably never ran. | The resolver marks transient pre-dispatch refusals `details.dispatched = false`; the worker passes `preDispatch` to the Phase 8 retry rule. Only the resolver can set the marker (an adapter's claim is stripped). | `p11-failures`: queued write retried and run once after a ledger outage; adapter forgery stripped; dispatched transient failure still not retried. |
| P11-B3 | Medium | The CONNECTION breaker used the capability threshold, so the same 5 failures of one capability also opened the connection breaker and locked the agent out of all capabilities. | Per-scope thresholds (connection 20); calls refused by an open breaker never count. | `p11-failures`: "the connection breaker needs failures across capabilities". |
| P11-B4 | Medium | `withAgentSpan` let a tracer exception fail the traced operation (or, after the callback, lose its result). | The operation's own promise is authoritative; a tracer failing before the callback runs the operation untraced. | `p11-failures`: tracer throwing before / after; observer throwing. |
| P11-B5 | Low | Ledger / recovery list views returned the wrong pagination shape (`pageMeta` arguments swapped, `meta` missing). | Use `{ rows, meta: pageMeta(total, page) }` and `skipFor`. | `tsc`; page tests. |

## Pre-existing issues fixed because Phase 11 depends on them

| ID | Issue | Fix |
|---|---|---|
| PRE-1 | One request had two request ids: the pipeline's (logs, error bodies) and a second one minted by `buildRequestContext` (gate, resolver). Evidence could not be joined to the error the agent saw. | `buildRequestContext` takes the pipeline's id (optional parameter, default unchanged). |

## Pre-existing, not fixed (outside Phase 11)

- `app/api/feedback/route.ts(128,11)` TS2322 (baseline typecheck error).
- Repository ESLint baseline problems in files Phase 11 did not touch.
- MCP `tools/list` projects `products.createDraft` and `coupons.create`, which have no adapter (a call fails cleanly with a Phase 4 error). Scheduled for Phase 13 (domain expansion), where tool projection is reworked.

## Known limits (by design, documented)

- Wholesale chain rewrite by a database superuser is detectable only against the logged external anchor (`02`).
- Breakers and metrics are process-local (`05`, `08`).
- No production capability declares a recovery mapping until Phase 13 (`06`).
