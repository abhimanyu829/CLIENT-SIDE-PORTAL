# Reconciliation Rules (Phase 10)

## Authority matrix (per fact)

| Fact | Authority |
|---|---|
| Payment verified | Phase-4 verified provider evidence (webhook signature contract) — never raw payload |
| Subscription lifecycle | Phase-4 normalized state machine |
| Charge exists/amount | `SubscriptionCharge` (unique payment id) in smallest units |
| Invoice | Financial document (not proof of payment) — not auto-reconciled |
| Effective access | Phase-3 resolver; a subscription row is NOT proof |
| Provisioning state | Phase-5 `SubscriptionProvisioning` (dedupe identity) |
| Settlement/payout | NOT AVAILABLE → `EXTERNAL_PROVIDER_UNAVAILABLE` recorded; Category F unsupported |

## Implemented categories

| Category | Rule | Severity | Repair |
|---|---|---|---|
| UNPROCESSED_EVENT | FAILED webhook events; PENDING older than 15m (`DEFAULT_THRESHOLDS.unprocessedEventMinutes`) | HIGH / MEDIUM | none (replay is money-adjacent → manual) |
| MISSING_PROVIDER_EVIDENCE | FAILED `SubscriptionCharge` | HIGH | none |
| AMOUNT_OR_CURRENCY_MISMATCH | charge amountSubunits ≤ 0 (exact integer units, no float math) | HIGH | none |
| DUPLICATE_RECORD | same `razorpayPaymentId` on multiple charges (unique constraint bypass evidence) | CRITICAL | none |
| STALE_SUBSCRIPTION_STATE | TRIALING/UNPAID with provider ref older than 60m; ACTIVE period ended >24h ago | MEDIUM | none (Phase-4 verification owns truth) |
| FAILED_PROVISIONING | Phase-5 `FAILED_RETRYABLE` (proposed `REPROCESS_PROVISIONING`); `FAILED_PERMANENT` detection-only | MEDIUM / HIGH | REPROCESS (allow-listed) |
| ENTITLEMENT_MISMATCH | expired-still-ACTIVE grant (LOW, `EXPIRE_STALE_GRANT`); ACTIVE source-grant for CANCELED/EXPIRED subscription (CRITICAL, `REVOKE_SUBSCRIPTION_GRANTS`); trial ACTIVE past expiry (MEDIUM, `EXPIRE_STALE_TRIALS`) | per row | allow-listed only |
| EXTERNAL_PROVIDER_UNAVAILABLE | informational: provider lookup/settlement evidence unavailable | LOW | none |

## False-positive notes

- Delayed webhooks inside the 15m window produce NO finding.
- Pending activation inside 60m produces NO finding.
- Standalone/ADMIN/PROMOTIONAL grants are NEVER scanned for source rules
  (source isolation, tested).
- Amount uses integer smallest-units (`amountSubunits`) — no binary-float
  comparison, no rounding tolerance.

## Thresholds

`DEFAULT_THRESHOLDS` in `rules.ts`; overridable per run via config JSON.
Documented rationale: 15m ≈ accepted webhook delivery+retry window; 60m ≈
activation + provisioning window; 24h ≈ renewal boundary buffer.