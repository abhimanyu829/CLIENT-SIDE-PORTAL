# 01 — Free Plan Architecture (Phase 6)

## Position

Additive access sources on the Phase-3 Entitlement Engine. Two new grant
origins (`FREE_PLAN`, `TRIAL`), two narrow enrollment records
(`FreeEnrollment`, `TrialEnrollment`), one pure policy module. No payment, no
checkout, no second engine, no UI.

```
FREE plan (Phase 2, zero price)
  → FreeEnrollment (unique per customer+version)
  → FREE_PLAN grants (permanent)          [enrollFreePlan]
Trial (Plan config, 14 days)
  → TrialEnrollment (unique per customer+version scope)
  → TRIAL grants (bound to trial expiry)  [startTrial]
        ↓
Phase 3 resolver  → effective access (unchanged authority)
```

## Domain separation kept intact

- Plan definition ≠ enrollment state.
- Trial exists ≠ trial is active (PENDING until grants provision).
- Subscription exists ≠ paid access (needs verified billing, Phase 4/5).
- Published FREE plan ≠ every product free — grants come strictly from the
  plan's items.

## Files

- `lib/services/free-trial-lifecycle.ts` — pure rules (duration math, scope
  keys, state machine, eligibility policy, errors).
- `lib/services/free-trial-service.ts` — enrollment + provisioning + expiry +
  conversion + worker hook.
- Schema: `FreeEnrollment`, `TrialEnrollment`, `TrialStatus`,
  `FreeEnrollmentStatus`, +`EntitlementSourceType.FREE_PLAN/TRIAL`.