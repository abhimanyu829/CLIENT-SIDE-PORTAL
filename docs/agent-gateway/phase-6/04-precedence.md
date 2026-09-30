# Phase 6 — Precedence Resolution (Deterministic, No Ambiguity)

## The exact order (as implemented in `precedence.ts`)

1. **Hard security deny** — evaluated in `engine.ts` *before* any policy is even consulted: invalid identity, `SUSPENDED`/`REVOKED`/`EXPIRED`/`PENDING` connection status, missing environment. No policy of any kind, priority, or scope can override this — there is no code path that reaches `resolvePrecedence()` at all once a hard deny has already fired.
2. **Explicit RESOURCE-scope DENY** — the narrowest possible deny wins first.
3. **Explicit CONNECTION-scope DENY**.
4. **Explicit CAPABILITY-scope DENY**.
5. **Any other explicit DENY** (OWNER/TEAM/RESOURCE_TYPE/ENVIRONMENT/GLOBAL) — still outranks every ALLOW/REQUIRES_APPROVAL.
6. **Explicit `REQUIRES_APPROVAL`** — outranks any remaining ALLOW.
7. **Most specific ALLOW** — ranked by an explicit specificity table (`RESOURCE` > `CONNECTION` > `CAPABILITY` > `RESOURCE_TYPE` > `TEAM` > `OWNER` > `ENVIRONMENT` > `GLOBAL`), never by insertion order.
8. **Broader ALLOW** — same mechanism as (7), just a lower-ranked scope winning because nothing narrower matched.
9. **Default deny** — no candidate matched at all.

## Tie-breaking within the same stage

When two candidates have the *same* scope specificity (e.g. two `CAPABILITY`-scoped ALLOWs), `AgentPolicy.priority` breaks the tie (higher wins). If priority also ties, the lexicographically smaller `policyId` wins — a fully deterministic, arbitrary-but-stable tiebreak that never depends on array/DB row order. Verified by `authz-precedence.test.ts`'s "same-specificity, same-priority ALLOWs break ties by lexicographically smaller policyId" test, which asserts the SAME result regardless of which order the candidates are passed in.

## Priority never overrides specificity or effect class

This is the spec's explicit warning ("the more specific rule should not automatically override a higher security restriction... explicit DENY should have deterministic precedence") made concrete: `priority` is consulted *only* as a tiebreaker among candidates that are already at the same precedence stage. A `GLOBAL` ALLOW with `priority: 999999` still loses to a `RESOURCE`-scoped DENY with `priority: 0` — verified by `authz-security.test.ts`'s "policy priority manipulation" attack test.

## No "last policy wins" behavior

There is no code path in `precedence.ts` that orders candidates by `createdAt`, array position, or any notion of "most recently written." The entire function is a pure reduction over the candidate set using the fixed rules above — calling it twice with the same (possibly reordered) input array always produces the identical winner. Verified by `authz-engine.test.ts`'s explicit "determinism" test.

## Worked example (from the spec's own Section G test construction)

Given: `allow global`, `deny connection`, `allow team`, `deny resource`, `allow capability`, `deny environment`, `approval requirement + allow` — all matching the same request:

1. `deny resource` is checked first (stage 2) → **wins**. Every other candidate is irrelevant once this fires.

If the resource-scope deny were absent: `deny connection` (stage 3) would win over `deny environment`/`allow capability`/`allow team`/`allow global`. If neither resource nor connection denies existed: the environment-scope deny (stage 5) would win over every remaining allow/approval. This cascade is exactly what `resolvePrecedence()` implements, and is exercised end-to-end by `authz-precedence.test.ts`'s "RESOURCE-scope DENY outranks everything else" and "CONNECTION-scope DENY outranks a CAPABILITY-scope ALLOW" tests.
