# 05 — Precedence (Phase 3)

## Access-type entitlements (PRODUCT / SERVICE / FEATURE / AI_CAPABILITY / SUPPORT)

ANY-valid semantics: one usable grant from any source ALLOWS access. Revoking or
expiring one source never removes another source's valid grant — source
separation is the point (subscription expiry does not kill a standalone purchase).

Winner selection for `getEntitlement` (deterministic total order):
1. latest `expiresAt` wins (null = never expires wins over dates)
2. latest `startsAt` wins
3. source rank: SUBSCRIPTION < STANDALONE_PURCHASE < ADMIN_GRANT < PROMOTIONAL
4. `sourceReference` lexicographic (total order, no ties)

## Limits (STORAGE / USER_LIMIT / ADMIN_LIMIT / RESOURCE_LIMIT)

HIGHEST valid limit wins (max). Never a blind sum — overlapping grants from
different sources must not stack into a larger-than-intended limit.
`getLimit` returns `{ limitValue: max, limitUnit: winner's unit }`.

## Revocation

A REVOKED/SUSPENDED/EXPIRED grant is excluded entirely; overlapping grants from
other sources still resolve. Documented per-type policies:

| type | rule |
|---|---|
| products/services/features/ai/support | UNION (any valid) |
| storage/user/admin/resource limits | MAX |
| winner tie-break | expiry → start → source rank → reference |

No arbitrary rule is invented: the above is the full, documented policy set.