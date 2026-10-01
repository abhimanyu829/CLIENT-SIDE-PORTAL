# Phase 14 — 05 Property tests

`p14-property` checks the security primitives over generated inputs (seeded, 400 iterations unless stated; failures report the iteration).

| Property | Primitive |
|---|---|
| every planted secret is removed; scrubbing is idempotent; secret-free text is unchanged | `scrubSecrets` / `containsSecret` |
| never throws; anything accepted is JSON-serialisable and free of bidi / NUL; refusals carry a reason code | `inspectAgentInput` |
| the binding digest is independent of key order and changes with any value | `canonicalJson`, `computeInputDigest` |
| output is either schema-valid and secret-free (trust label set) or withheld with a known reason; never throws | `guardAgentOutput` |
| total and bounded: any input up to hundreds of fragments returns known signal codes in < 250 ms (60 iterations) | `detectInText`, `detectInjection` |
| every private / loopback / metadata / encoded IP literal and every off-allowlist host is refused; the allowlisted host passes | `checkOutboundUrl` |
| a `_meta` idempotency key is accepted iff it matches the documented pattern and has no reserved prefix | `idempotencyKeyFromMeta` |
| captured recovery input is only the mapped top-level primitive fields | `captureRecoveryInput` |

All 8 properties hold.
