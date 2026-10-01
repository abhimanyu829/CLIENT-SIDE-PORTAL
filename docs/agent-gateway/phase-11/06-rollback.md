# Phase 11 — 06 Rollback: the declarative model

Rollback never means "reverse every database change". Each capability declares, in its Phase 3 definition (`rollback.recovery`, `recovery/spec.ts`), what recovery is possible:

| Class | Meaning | What runs |
|---|---|---|
| REVERSIBLE | an explicit reverse capability restores the previous state | that capability |
| COMPENSATABLE | an explicit compensation offsets the effect; the original record remains | that capability; `residualEffects` recorded |
| PARTIALLY_REVERSIBLE | supported state is restored; documented residual effects remain | that capability; `residualEffects` recorded |
| IRREVERSIBLE | cannot be undone | nothing; `MANUAL_RECOVERY_REQUIRED` with the capability's recommendation |

```ts
rollback: {
  reversibility: "REVERSIBLE",
  mechanism: "Archive the created thing.",
  recovery: {
    class: "COMPENSATABLE",
    capabilityId: "fixtures.archiveThing",     // a registered capability
    capabilityVersion: 1,                       // exact version
    inputMapping: { thingId: "output.id" },     // recovery field <- original input./output. field
    residualEffects: "The archived thing remains visible in history.",
    manualRecoveryRequired: false,
    recommendation: "Archive the thing the agent created.",
  },
}
```

## Rules (enforced at registration, `assertValidRecoverySpec`)

- The mapping is **data**: a capability id + version and a field map. No function, no `rollback(arbitraryOperation)`, no dynamic target.
- Sources are only `input.<field>` / `output.<field>` (top level); 1–10 mappings; field names `[A-Za-z][A-Za-z0-9_]*`.
- A capability cannot recover itself; non-IRREVERSIBLE classes require the recovery capability id and version; IRREVERSIBLE may not reference one.
- A capability whose Phase 3 `reversibility` is IRREVERSIBLE cannot declare an automatic recovery.
- A recommendation (≤500 chars) is mandatory.
- **A write without a mapping is treated as IRREVERSIBLE / manual** (`resolveRecoverySpec`) — nothing is invented. READs have nothing to recover.

Registration rejects nine malformed variants (tested).

## Evidence captured at execution time

When a write with a mapping succeeds, the resolver captures exactly the mapped identifiers from the validated input and the schema-validated output into the `execution.succeeded` event (`metadata.recoveryInput`, flat, identifier-valued, redacted like all metadata). A mapped value that is missing or not a primitive captures nothing → the later recovery is manual (`RECOVERY_INPUT_UNAVAILABLE`). Recovery is never reconstructed from current, mutable state.

## Production capabilities in Phase 11

None of the 8 core capabilities declares a mapping yet: the executable ones are READs, and the two LOW_RISK_WRITE ones have no adapter. Their recovery is therefore manual by construction. Phase 13 adds the first real mapping (`tickets.create` → `tickets.close`). The semantics are proven with fixture capabilities that change an in-memory store (`tests/recovery-test-kit.ts`).
