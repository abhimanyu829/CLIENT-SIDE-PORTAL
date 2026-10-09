# 08 — Security (Phase 5)

## Threat controls (Group J, all tested)

| Threat | Control |
|---|---|
| Forged subscription id | trusted DB lookup; unknown → permanent error |
| Forged owner/team | owner/banned check; subject always derived from the subscription |
| Forged plan version | bound `planVersionId` only; DRAFT/unknown → permanent |
| Forged entitlement key | definitions validated before grants; missing → permanent, zero grants |
| Forged billing period | `grantWindowFor` rejects invalid dates (`INVALID_PERIOD`) |
| Unverified event | Phase-4 hook passes only post-verification signals; engine has no provider input surface |
| Duplicate/alterated events | dedupeKey identity; SUCCEEDED replay is inert |
| Cross-tenant provisioning | grants keyed to `subscription.userId`; no client ids accepted |
| Cross-environment | `environment` equality enforced (legacy null allowed) |
| Source substitution | grants always carry the exact internal subscription id (tested) |
| Revoking others' grants | revocation filtered by `sourceType=SUBSCRIPTION, sourceReference=<id>` |
| Extending without renewal | extensions only from VERIFIED periods in renewal ops; equal/earlier refused |
| Replaying completed work | unique keys + SUCCEEDED short-circuit |
| Terminal-state abuse | status gates (TRIALING/CANCELED never grant); EXPIRED/REVOKED grants skipped |
| Direct mutation API | no routes; internal service only; commerce/billing/prov tables trapped in tests |

## Error model

`ProvisioningError` with stable codes and `permanent` classification. No SQL,
stack traces, secrets or unrelated tenant data leak. Grant errors from Phase 3
are propagated as permanent (they encode catalog/definition integrity).