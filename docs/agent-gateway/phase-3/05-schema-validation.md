# Phase 3 — Schema Validation

## Technology choice

zod — already a dependency of this codebase (`lib/agent-gateway/config.ts` uses it in Phase 1; `package.json` pins `zod@^3.23.8`). No second validation framework was introduced.

## `validateAgainstSchema()` (`schema-validation.ts`)

A thin wrapper: `schema.safeParse(input)`, and on failure throws `CapabilityError("INVALID_INPUT", ..., details)` where `details.issues` is an array of `{ path, code, message }` — field-level detail only. The raw input value is never included in the thrown error, verified explicitly by a test that submits a payload containing a marker string and asserts the marker never appears in `JSON.stringify(error.details)`.

## Every registered input schema is `.strict()`

Every schema in `manifest.ts` is built with `.strict()` (or is a `.strict()`-composed object), which makes zod reject any object with fields beyond the ones explicitly declared. This is the primary defense against:

- **Unexpected execution parameters** — a caller cannot smuggle an extra field that a naive future adapter might read.
- **Prototype-pollution-shaped payloads** — a JSON-parsed object literal like `{"id":"x","__proto__":{"admin":true}}` creates a real *own-enumerable* `"__proto__"` string key (this is a JSON/`JSON.parse` quirk, not the object's actual prototype chain) — a `.strict()` schema rejects it as an unrecognized field, exactly like any other unexpected key. Verified by a dedicated security test using `JSON.parse` (not an object literal, which would set the actual prototype instead of an own property) to reproduce the real-world attack shape.

## Bounds and constraints

Every field in every registered schema declares an explicit bound — `z.string().max(N)`, `z.number().int().positive().max(N)`, `z.enum([...])`, or `z.array(...).max(N)` — never an unbounded `z.string()` or `z.any()`. This directly satisfies the spec's requirement to constrain "string length limits, numeric bounds, nullability" etc. for every capability.

## What is rejected by design

- Deeply nested objects where a flat field is expected (e.g. `{ id: { $where: {...} } }` against `z.object({ id: z.string() })`) — zod's type check on `id` fails outright; the nested object is never partially inspected.
- Oversized strings beyond a schema's declared `.max()`.
- Array-shaped input where an object is expected, and vice versa.
- `null`/`undefined` against a schema with required fields.

## What this validation deliberately does NOT do

It does not — and cannot — validate business rules (e.g. "does this product id actually exist," "does this user own this subscription"). That is explicitly Phase 4 (execution adapter) and Phase 6 (policy) territory. `validateInput()` only proves the SHAPE of the input is safe and well-formed; it makes no claim about the input's business validity.
