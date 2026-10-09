# 03 — Trial Eligibility (Phase 6)

## Scope

One trial per customer per plan version:

```
trialScopeKey = sha256(userId | planVersionId)   // unique
```

Enforced by `TrialEnrollment.trialScopeKey @unique` — concurrent requests
cannot create two trials for the same scope.

## Server-side checks (startTrial)

1. Authenticated customer → banned/invalid rejected.
2. Plan exists, is PUBLISHED, and is a billable type (never FREE).
3. Plan version PUBLISHED.
4. Verified account (default policy `TRIAL_REQUIRES_VERIFIED_ACCOUNT`).
5. No PENDING (retry provisioning) and no ACTIVE trial for the scope
   (`TRIAL_ALREADY_ACTIVE`).
6. No consumed trial (EXPIRED/CANCELLED/CONVERTED) for the scope
   (`TRIAL_ALREADY_USED`).
7. No active paid subscription on the account (`TRIAL_ALREADY_ACTIVE`).

## Abuse controls

- Identity from the session only (`userId`), never client-supplied owner/team.
- Rate/duplicate protection: unique scope key + atomic create.
- Existing standalone purchases are never affected by eligibility rules.