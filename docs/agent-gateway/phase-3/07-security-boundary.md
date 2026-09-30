# Phase 3 — Security Boundary

## The core principle: existence != authorization

A capability existing in the registry means only that its CONTRACT has been reviewed and described. It does not mean:
- it is authorized for any specific caller (that's Phase 6 policy),
- it has been approved (that's Phase 7 approval/autonomy),
- it grants any autonomy level, quota, or budget (none of those exist anywhere in this codebase).

These are deliberately kept as separate, future concerns. Phase 3 introduces zero policy logic, zero approval logic, zero autonomy state.

## Exposure levels

| Level | Meaning | Discoverable via `list()` by default? |
|---|---|---|
| `PUBLIC_DISCOVERABLE` | Metadata may be listed to any internal caller without further restriction. Still never reachable by an unauthenticated HTTP caller — no such endpoint exists. | Yes |
| `INTERNAL_ONLY` | Exists for internal reference and future Phase 4+ wiring; not (yet) a candidate for direct agent invocation. Used for `products.updatePricing` (HIGH_RISK_MUTATION) — its contract is described, but it is not marked `AGENT_AVAILABLE` because no Phase 6/7 policy+approval story exists yet to gate it. | Yes |
| `AGENT_AVAILABLE` | The capability's contract is considered stable enough that a FUTURE, separately-authorized executor could invoke it. Grants nothing by itself — no executor exists in Phase 3. Used for the READ and LOW_RISK_WRITE examples. | Yes |
| `DISABLED` | Temporarily inactive. `resolve()` fails closed (`CAPABILITY_DISABLED`). | No (opt-in via `includeDisabled`) |
| `DEPRECATED` | Still resolvable by exact reference (explicit signal to migrate), never selected as "latest". | Yes (but see id-versioning doc — excluded from default resolution) |
| `FORBIDDEN` | Architecturally excluded from ever being agent-callable (Phase 0's `AI_BLOCKED` tier). The registry can describe THAT such an operation exists and WHY it is blocked, but its `executionReference` must always be `null`. Used for `refunds.process`. | No (opt-in via `includeForbidden`) |

## Why `CapabilityError` is a separate type from `GatewayError`

`GatewayError` (Phase 1, `shared/errors.ts`) is the HTTP-transport error contract for the request pipeline that terminates in an actual `Response`. The capability registry has no HTTP surface in Phase 3 — it is a plain internal library. Keeping the types separate means a future HTTP-facing consumer (Phase 5's MCP server, if built) makes an explicit, reviewed choice about how to map `CapabilityError` codes onto `GatewayError` codes/HTTP statuses, rather than this layer silently assuming HTTP semantics it does not have and never will in this phase.

## Dangerous-primitive guard (defense in depth)

`dangerous-primitive-guard.ts`'s `assertNoDangerousPrimitives()` runs on every `register()` call, scanning `id`, `domain`, and `executionReference.adapterKey` (identifiers only, never free-text description fields — see `06-risk-and-side-effect-metadata.md` for why) against a token list covering every explicitly forbidden primitive class from the architecture spec:

`eval`, `new Function(`, `child_process`/`exec`/`spawn`/`shell`, raw SQL/`prisma`/`database`/`rawQuery`/`executeRaw`/`queryRaw`, `require(`/`import(`, `fetch`/`httpRequest`/`proxy`, `fs.`/`filesystem`/`readFile`/`writeFile`, `process.env`/`env.`.

This runs even though no execution engine exists yet — it exists so that Phase 4 cannot accidentally register a dangerous adapter key either, since the guard fires at the SAME `register()` call any future manifest addition would go through.

## FORBIDDEN capabilities are structurally, not just conventionally, blocked

The registry's own `assertWellFormed()` throws if `exposure === "FORBIDDEN"` and `executionReference !== null` — this is not a manifest-authoring convention that could be forgotten, it is a hard rejection at registration time. `refunds.process` is registered with `executionReference: null` and `inputSchema: null` (exempted, since `FORBIDDEN` capabilities are excluded from the "must have an input schema" rule) specifically to prove this path works, not merely to assert it in prose.

## Immutability from callers

See `04-capability-registry.md`'s "Immutability" section — every stored definition, including every nested metadata object, is deep-frozen. A caller holding a reference to a resolved definition cannot mutate it to escalate its own permission, exposure, or execution reference.
