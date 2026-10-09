# 02 — Trial Policy (Phase 6)

## Duration

Default: 14 consecutive 24-hour periods, UTC:

```
trialExpiresAt = startedAt + 14 * 24h (ms)
```

`TRIAL_DURATION_DAYS = 14` configurable constant. Signup time is irrelevant;
the trial starts at activation. Frontend clocks are never trusted; all math is
on UTC timestamps.

## Benefits come from plan configuration

Trial grants are exactly the eligible published plan version's items (products,
features, limits). No client-selected benefit lists. Default offer guidance
(single product, 1 admin user, limited storage/bandwidth, no SEO/AEO/managed
traffic/premium AI by default) is realized by configuring the trial plan with
those items — the engine enforces composition, not hard-coded product lists.

## Public demo vs trial

`DemoSession` (anonymous/product preview) is untouched and never provisions
entitlements. Trials require an authenticated, verified account.

## Distinctions

- Trial exists ≠ active: PENDING until entitlement provisioning succeeds.
- Access denied once `now >= trialExpiresAt`, independent of any cleanup job.