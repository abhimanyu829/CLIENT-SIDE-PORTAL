# Phase 6 — Policy Language (Declarative ABAC, No Code Execution)

## The closed operator set

`equals`, `notEquals`, `in`, `notIn`, `contains`, `startsWith`, `exists`, `greaterThan`, `lessThan`, combined with `and`/`or`/`not`. This is the spec's exact list — no operator exists outside this set, and `assertWellFormedCondition()` (the write-time guard) rejects any policy attempting to declare an operator string not in this fixed list, with a specific test (`authz-security.test.ts` #11) proving an injected operator like `"$where"` is rejected before it can ever be stored.

## Why arbitrary code execution is structurally impossible, not just discouraged

- **The condition tree is plain JSON** (`ConditionNode` in `types.ts`) — a union of four shapes (`{operator, attribute, value?}`, `{and: [...]}`, `{or: [...]}`, `{not: ...}`). None of these shapes can hold a function value: TypeScript's structural typing rejects one at the write-path call sites, and — more importantly, since a malicious actor doesn't have to go through TypeScript — a value read back from Postgres's `JSONB` column via `JSON.parse` can **never** produce a live function reference. There is no `eval()`, `new Function()`, `vm.runInContext()`, dynamic `import()`, or template-literal interpolation-into-code anywhere in `policy-language.ts` or `engine.ts`.
- **Attribute resolution goes through a fixed, explicit map** (`ATTRIBUTE_RESOLVERS` in `policy-language.ts`), never dynamic property access on the context object. A policy can only ever reference one of ~13 pre-declared dotted names (`subject.ownerId`, `action.riskTier`, `environment.name`, etc.) — there is no `context[attributeName]` anywhere, which also closes the prototype-pollution attack surface (see below).
- **`evaluateCondition()` is a plain recursive `switch`** over the closed operator set — adding a new operator requires editing this source file, not something a stored policy row can ever introduce at runtime.

## The one real bug this phase found (see `13-bug-report.md` for full detail)

A prototype-pollution-shaped attribute name (`"constructor"`, `"__proto__"`, `"toString"`) initially resolved *through the JavaScript prototype chain* rather than correctly returning "not found," because the original lookup used a plain `ATTRIBUTE_RESOLVERS[name]` bracket access (and `attribute in ATTRIBUTE_RESOLVERS` in the write-time validator) — both of which walk the prototype chain by default. Fixed by switching both lookups to `Object.prototype.hasOwnProperty.call(ATTRIBUTE_RESOLVERS, name)`, which only ever matches an attribute this module explicitly declared as its own property. Caught by this phase's own test suite (`authz-policy-language.test.ts`) before ever reaching production code.

## Write-time validation (`assertWellFormedCondition`)

Every condition tree is validated *before* it is ever persisted (`policy-store.ts`'s `createPolicyVersion()` calls this and throws — never silently stores — a malformed tree). Validation checks: recognized operator, recognized attribute (same `hasOwnProperty` guard as the read path), a `value` field present when the operator requires one, and a maximum nesting depth of 12 (defense against a pathologically deep tree causing excessive recursion at evaluation time — a DoS-shaped, not code-execution-shaped, concern).

## Read-time evaluation is fail-safe, not fail-throw

`evaluateCondition()` never throws for a malformed *node* it encounters at read time (as opposed to write time) — an unrecognized shape, missing array, or unknown attribute all resolve to `false` (does not match), never an exception. This matters because a condition tree could, in principle, reach the evaluator having bypassed the write-time guard (e.g. a row inserted by external tooling, not through `createPolicyVersion()`) — `authz-failure.test.ts`'s "malformed policy" test constructs exactly this scenario and confirms the overall authorization request still resolves to a clean `DEFAULT_DENY_NO_POLICY`, never a crash and never an accidental match.

## Attribute vocabulary (the full, closed list)

`subject.connectionId`, `subject.agentId`, `subject.ownerId`, `subject.teamId`, `subject.connectionStatus`, `subject.authenticationStrength`, `action.capabilityId`, `action.capabilityVersion`, `action.riskTier`, `resource.resourceType`, `resource.resourceId`, `environment.name`, `request.authenticationStrength`. Every one of these maps directly to a field on the trusted `AuthorizationContext` — there is no attribute name that reads anything outside that context object.
