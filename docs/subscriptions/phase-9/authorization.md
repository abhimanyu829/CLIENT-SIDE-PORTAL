# Authorization — Phase 9

## Identity model (reused)

- Machine/agent identity: the existing Agent Gateway connection +
  `context.ownerId` (Phase-2 trusted machine principal). Agent requests never
  carry a Clerk session; human principals are distinct.
- No customer delegation layer exists in the gateway; the owner scope IS the
  machine identity's owner — the trust boundary used by every existing adapter.
- Administrative delegation: does not exist (no admin-delegated agent
  identity); therefore **no** administrator-copilot tools are registered —
  documented rather than fabricated.

## Default-deny

- Tool/schema validation fails closed (unknown tool names rejected by the
  registry; strict zod rejects extra/privileged fields).
- `READ` executes only when identity context (`connectionId`, `ownerId`)
  resolves and the action passes the existing authorization/autonomy policy.
- `HIGH_RISK_MUTATION` additionally requires the gateway's mandatory approval
  gate (evaluator step 9: `REQUIRE_APPROVAL` — no autonomy level removes it).
  A model-provided `confirmed: true` is not an input field anywhere.
- Ownership failure is normalized to `RESOURCE_NOT_FOUND` (no existence leak).

## Separation maintained

Agent permission ≠ customer eligibility ≠ human RBAC. The capabilities carry
permission metadata (`read:billing`, `read:entitlements`, `write:billing`);
the existing policy engine and approval flow apply them server-side. Phase 8
administrative tools are never reachable by agents.