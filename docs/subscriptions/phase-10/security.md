# Security (Phase 10)

- Reconciliation API sits behind `adminSubscriptionGate` (SubscriptionGovernance
  resource): VIEW reads runs/findings; APPROVE starts runs and applies repairs.
  Customers/anonymous/banned rejected (401/403) — same guard as Phase 8.
- Webhook trust boundary untouched: Phase-4 raw-body HMAC verification remains
  the only ingestion path; reconciliation never replays or accepts unsigned
  events; it only classifies persisted inbox rows.
- Findings sanitize evidence: no secrets/signatures/payload blobs; expected/
  observed values are normalized scalars; `errorMessage` truncated to 500 chars.
- Audit: run completion + every repair recorded (`RECONCILIATION_*` actions) —
  a repair whose audit write fails propagates (never reported as auditable
  success without evidence).
- Money safety: no code path in Phase 10 creates or mutates Payment,
  SubscriptionCharge, Invoice, or Order rows; repairs call only Phase 3/5/6
  services (proven by allow-list + engine source scan in tests).
- RBAC/Phase-9 separation preserved: no new AI-agent tools registered; the
  gateway cannot trigger repairs.
- Rate limiting: runs guarded by single-active-run rule; scans bounded
  (batchSize ≤ 500); no provider API calls (no credential use).