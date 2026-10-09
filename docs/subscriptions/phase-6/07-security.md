# 07 — Security (Phase 6)

## Threat controls (all tested in the suite)

| Threat | Control |
|---|---|
| Forged customer/owner/team | identity server-derived from the session; unknown/banned rejected |
| Forged plan / version | trusted DB lookup; unpublished/DRAFT/FREE-as-trial rejected |
| Forged trial duration/expiry | `startTrial(userId, planId)` contract only; boundary = server math (`+14d`) |
| Forged entitlement list | grants come strictly from the bound plan version items |
| Forged status | statuses server-controlled via the trial state machine; no input field |
| Cross-tenant enrollment | scope keys carry the session user; cancellation checks ownership |
| Duplicate trial exploitation | `trialScopeKey @unique` + eligibility (active/consumed/paid gates) |
| Unauthorized free enrollment | verified customer + existing FREE enrollment dedupe |
| Expired-trial access | read-time `expiresAt` rule on grants + enrollment |
| Trial revocation hurting standalone | source-scoped expiry (exact trial reference only) |
| Unauthorized/early conversion | requires ACTIVE paid subscription + provisioned paid grant |
| Unverified payment conversion | pending/UNPAID states never convert |
| Direct grant mutation | no public grant APIs; all writes via Phase-3 services only |
| Environment mismatch | enrollment stores environment; grant/provision checks match current |

## Error model

`FreeTrialError` with stable codes (`FREE_PLAN_UNAVAILABLE`, `TRIAL_NOT_ELIGIBLE`,
`TRIAL_ALREADY_USED`, `TRIAL_ALREADY_ACTIVE`, `TRIAL_PROVISIONING_FAILED`,
`PAID_CONVERSION_NOT_CONFIRMED`, `PAID_CONVERSION_PENDING`,
`TRIAL_STATE_CONFLICT`, ...). No raw DB details or secrets leak.