# Admin Workflows — Phase 8

## Inspect a subscription

Governance → Subscriptions → filter/search → open detail. Shows internal id,
customer (limited), plan + immutable version, status, provider ref, verified
period, cancelAtPeriodEnd, charges/invoices/payments, source-bound grants,
provisioning operations, admin audit entries. Read-only until an action is
chosen.

## Lifecycle action

Detail → Cancel at period end / Cancel immediately / Pause / Resume →
confirmation dialog (requires WRITE-appropriate permission) → reason recorded →
Phase-4 op runs with admin as actor → result returned and views refreshed.
Failures leave the real backend state; no status label is changed without an
executed operation.

## Plan governance

Plan Catalog tab → create draft (POST /plans), publish/pause/resume/archive
with confirmation, new draft version (published versions immutable). Editing a
published version is impossible — the Phase-2 service refuses.

## Free & Trial oversight

Read-only list of enrollments (customer, plan, status, windows). No trial
reset, extension, or override exists in the backend — not surfaced (see
limitations).

## Issues + Audit

Operational Issues aggregates failed provisioning, failed charges, failed
webhooks (sanitized). Audit History shows recorded admin/actor actions —
read-only; no edit/delete path exists.