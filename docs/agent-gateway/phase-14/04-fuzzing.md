# Phase 14 — 04 Fuzzing

`p14-fuzz` sends seeded hostile arguments to every tool of the live surface (12 capability tools + 3 task tools; the suite first asserts the fuzzed set equals the listed set).

## Generator (`simulation/fuzzer.ts`)

mulberry32 PRNG, seed `20261001 + toolIndex`, 24 cases per tool, alternating tenants, each with its own idempotency key. Cases mutate a known-valid base so many pass the schema and reach deeper layers:

| Strategy | Mutation |
|---|---|
| replace-field | one field becomes a hostile value |
| identity-injection | adds `ownerId` / `userId` / `clientId` / `connectionId` / `teamId` / `vendorId` / `role` / `isAdmin` / `assignedTo` |
| unknown-field | adds a random key with a hostile value |
| drop-field | removes a required field |
| deep | 10–40 levels of nesting |
| wide | arrays of 100–6000 elements |
| prototype-key | `__proto__` / `constructor` / `prototype` as real own keys (built as JSON text) |
| type-confusion | value wrapped in an array / object, stringified, numeric, null |
| multi-field | several fields replaced |

Hostile values: empty / huge strings, NUL and bell, bidi and isolate controls, tag smuggling, zero-width, lone surrogates, emoji and Indic / Persian text, HTML, SQL, path traversal, template syntax, injection payloads, chat-template markup, tool-call JSON, markdown beacons, credential-shaped strings, URL credentials, cloud metadata URL, other tenants' ids, wildcards, reserved key prefixes, numeric edges.

## Oracles

Per case: the gateway returns an answer (never throws); a success satisfies the capability's output schema. Per tool: all nine invariants over every observation and the final world; at least one refusal was exercised.

## Result

360 cases, 15 / 15 tools pass after the fix of P14-F1, which the fuzzer found: the MCP SDK's own validation error (`received '<value>'`) reflected a credential-shaped value back to the agent (I2), seed `20261003`, `products.listMine`, index 22.
