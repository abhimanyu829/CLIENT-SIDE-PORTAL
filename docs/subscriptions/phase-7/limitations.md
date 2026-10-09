# Limitations — Phase 7

## Unsupported in the real backend (truthfully not offered)

- Upgrade / downgrade / plan switching: Phase 4 exposes no plan-change or
  proration contract; the UI does not invent one. Changing plans is a
  documented future dependency (Phase 10/reconciliation + provider change flow).
- Payment-method management (replace card), refunds, retry-payment: not
  supported by existing services; not surfaced.
- Pause/resume: only what Phase-4 API accepts (pause ACTIVE, resume PAUSED).
- Trial conversion button: not exposed; conversion is the explicit paid
  checkout path (Phase 6 policy: no auto-conversion, no silent charge).

## Known gaps (documented, not Phase-7 scope)

- Standalone-access explanation vs subscription: overview shows effective
  entitlement keys; per-product standalone breakdown remains on existing
  My Products pages.
- Trial default-offer rails (1 product, 1 admin, small storage, no SEO/AEO/
  managed traffic) are enforced by configuring the trial plan's items; the
  engine grants exactly the plan content. Sandbox/test-data isolation applies
  only where the product itself supports it (none currently wired).
- Live paid/trial end-to-end needs Razorpay TEST credentials (Phase-4
  follow-up, deferred per user to the end).
- Component interaction tests: infrastructure absent (see testing.md).

## Deferred

- Phase 8 SUPER_ADMIN governance UI; Phase 9 AI governance; Phase 10 billing
  reconciliation and settlement recovery — deliberately not implemented.