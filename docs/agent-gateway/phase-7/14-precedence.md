# Phase 7 — Precedence

From strongest to weakest. A stronger layer's denial can never be relaxed by a weaker one.

1. Identity invalid (suspended, revoked, expired, missing owner) -> deny
2. Any policy subsystem unavailable -> deny (`POLICY_UNAVAILABLE`)
3. Phase 6 DENY -> deny
4. Capability hard state (not agent-available / inactive / Phase 3 FORBIDDEN) -> deny
5. Autonomy scope (environment, allowlist, resource, risk ceiling) -> deny
6. Autonomy level matrix -> deny or approval
7. Mandatory approval gates (Phase 3 metadata, per-connection list, Phase 6 REQUIRES_APPROVAL) -> approval
8. Human approval for the exact binding, unexpired, unconsumed -> may execute once
9. Autonomous within bounds -> execute

Two consequences:

- A human approval cannot override steps 1–5. If Phase 6 starts denying after approval, the approval is not consumed and the call is denied.
- Phase 6 `REQUIRES_APPROVAL` cannot lift an autonomy denial. At OBSERVE_ONLY a mutation is denied even if Phase 6 would accept it with approval.
