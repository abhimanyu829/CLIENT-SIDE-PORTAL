# 06 — Security (Phase 1)

## Guarantees (all covered by tests in `lib/services/__tests__/`)

| Threat | Control | Test file |
|---|---|---|
| Forged customer/owner ID | Owner existence + ban check before create | foundation, security |
| Client-controlled status | Strict zod schema (unknown `status` key rejected); initial status server-chosen | security, foundation |
| Cross-tenant access | `getSubscriptionForOwner` returns null for non-owners (anti-enumeration) | foundation, security |
| Arbitrary provider references | `stripeSubId`/`razorpaySubId` rejected as unknown input keys; `externalReference` confined to metadata | security |
| Payment credential / API key storage | None stored; Phase 1 never handles credentials | domain-separation |
| Webhook trust | Phase 1 adds no webhook; existing HMAC/nonce verification untouched | audit (01) |
| Direct DB mutation from clients | No exposed raw-write route; all mutations via guarded service functions | guards, security |
| Forged/invalid environment | Controlled 3-value set, normalized server-side | security, state-machine |
| Invalid state transitions | State-machine guard before every write; terminal CANCELLED protected | guards, state-machine |
| Stale concurrent transitions | Compare-and-set (`updateMany where status = expected`); loser gets conflict or idempotent no-op | concurrency, foundation |
| Unauthorized creation | Referential integrity (user/product/tier) + strict schema; no partial row on any failure | foundation, failure |

## Deliberate behaviour change (intentional fix)

Pre-Phase-1: a late `payment.failed` webhook could flip a CANCELLED subscription to
PAST_DUE (reviving it). Post-Phase-1: `markSubscriptionPastDue` on CANCELLED is refused
(soft-skip + warn log; webhook never sees an exception). Documented, tested
(`guard: markSubscriptionPastDue > refuses to mark a CANCELLED subscription`).

## Auth reuse

No new auth system. Clerk session (proxy.ts) + existing admin RBAC headers remain the
only authentication/authorization surfaces. Foundation APIs are internal-only.
