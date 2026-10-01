# Phase 10 — Approval Management

Governance shows approval requests; **deciding stays exclusively in the Phase 7 flow** (`/admin/agent-approvals/[ref]`): the administrator confirms the exact binding digest and enters an SMS step-up code; agent credentials are refused; approvals are single use and bound to one operation.

## The approvals page

- Filters: effective status (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `CONSUMED`) and connection; server-side pages of 20.
- Display-time expiry: a `PENDING` / `APPROVED` request past its deadline is shown and filtered as `EXPIRED` (the state transition itself happens on the next gate or decision touch, as in Phase 7).
- Columns: reference (link to the decision page), status, capability@version, risk, connection, environment, resource, requested, expires.
- The list never contains the binding digest, the display summary or step-up material (those appear only on the decision page, where they are needed).

## No shortcut

The governance module exports no approve / decide / step-up function and has no approval route (tested). Cancelling a connection's approvals happens only as a side effect of suspending or revoking it (Phase 7 behaviour).

## Tests

`p10-governance-views.test.ts` F (filters, 25 requests over 2 pages, display-time expiry, no binding material, no decide operation), cross-phase Scenario 2 (approval -> one bound task -> single use), master E2E steps 14–15.
