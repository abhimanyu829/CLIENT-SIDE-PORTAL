/**
 * lib/agent-gateway/authorization/policy-language.ts
 *
 * The constrained declarative condition evaluator. Per the Phase 6 spec:
 * "Do NOT allow eval(), JavaScript expressions, arbitrary functions,
 * dynamic imports, shell, SQL, HTTP calls, database queries. Policies
 * must never execute arbitrary code."
 *
 * This module enforces that by construction, not by convention:
 *   - `ConditionNode` (types.ts) is a plain JSON tree — it cannot hold a
 *     function value; TypeScript's structural typing rejects one at
 *     compile time, and `JSON.parse`d policy data (from the DB's `Json`
 *     column) can never produce a function value either.
 *   - `evaluateCondition()` never calls `eval`, `new Function`, `require`,
 *     `import()`, or any dynamic code path. It is a plain recursive
 *     switch over a closed, fixed operator set.
 *   - Attribute lookup goes through a FIXED, explicit resolver map
 *     (`ATTRIBUTE_RESOLVERS`) keyed by attribute name — a policy can only
 *     ever reference one of these pre-declared attributes, never an
 *     arbitrary object path, never a prototype-chain property, and never
 *     anything resolved via `context[attributeName]` dynamic indexing
 *     (which would be a prototype-pollution/property-injection surface).
 *
 * `evaluateCondition` is a pure function: same (context, node) always
 * yields the same boolean, no I/O, no mutation, no exceptions thrown for
 * "normal" malformed input (unknown attribute/operator resolves to
 * `false`, never throws) — a malformed CONDITION should make its parent
 * policy simply not match, not crash the whole evaluation (a crash would
 * risk being converted to a DENY-by-catch, which is fine, but a clean
 * `false` is simpler to reason about and impossible to mistake for a bug
 * in the caller).
 */
import type { AuthorizationContext, ConditionNode, ConditionOperator } from "./types"

type AttributeValue = string | number | boolean | null | undefined

/**
 * The closed set of attributes a policy condition may reference, mapped
 * to how to pull that value from the trusted AuthorizationContext. This
 * is the ONLY lookup mechanism — there is no fallback to dynamic property
 * access, so a policy author cannot reference anything not listed here
 * (e.g. no `__proto__`, no nested `resourceContext.arbitrary.path`).
 */
const ATTRIBUTE_RESOLVERS: Record<string, (ctx: AuthorizationContext) => AttributeValue> = {
  "subject.connectionId": (ctx) => ctx.connectionId,
  "subject.agentId": (ctx) => ctx.agentId,
  "subject.ownerId": (ctx) => ctx.ownerId,
  "subject.teamId": (ctx) => ctx.teamId ?? undefined,
  "subject.connectionStatus": (ctx) => ctx.connectionStatus,
  "subject.authenticationStrength": (ctx) => ctx.authenticationStrength,

  "action.capabilityId": (ctx) => ctx.capabilityId,
  "action.capabilityVersion": (ctx) => ctx.capabilityVersion,
  "action.riskTier": (ctx) => ctx.capabilityRiskTier,

  "resource.resourceType": (ctx) => ctx.capabilityResourceType,
  "resource.resourceId": (ctx) => ctx.resourceId,

  "environment.name": (ctx) => ctx.environment,

  "request.authenticationStrength": (ctx) => ctx.authenticationStrength,
}

export const ALLOWED_ATTRIBUTES: readonly string[] = Object.keys(ATTRIBUTE_RESOLVERS)

function resolveAttribute(ctx: AuthorizationContext, name: string): AttributeValue {
  // Object.prototype.hasOwnProperty.call — NOT plain `ATTRIBUTE_RESOLVERS[name]`
  // or `name in ATTRIBUTE_RESOLVERS` — deliberately guards against a
  // policy attribute string that happens to collide with an INHERITED
  // Object.prototype member (e.g. "constructor", "toString",
  // "hasOwnProperty", "__proto__"). A plain bracket lookup would resolve
  // those through the prototype chain to a real (non-resolver) function
  // value and then attempt to CALL it as `resolver(ctx)` — not a crash,
  // but a real attribute-lookup integrity bug: an attacker-chosen
  // attribute name could reach an unintended prototype member. Found via
  // this module's own security test suite (see
  // authz-policy-language.test.ts's "prototype-pollution-shaped attribute
  // name" test) — classified P1, fixed here, never silently narrowed.
  if (!Object.prototype.hasOwnProperty.call(ATTRIBUTE_RESOLVERS, name)) return undefined
  const resolver = ATTRIBUTE_RESOLVERS[name]
  return resolver(ctx)
}

function coerceForCompare(v: AttributeValue): string | number | boolean | undefined {
  if (v === null || v === undefined) return undefined
  return v
}

function evaluateLeaf(ctx: AuthorizationContext, operator: ConditionOperator, attribute: string, value: unknown): boolean {
  const actual = coerceForCompare(resolveAttribute(ctx, attribute))

  switch (operator) {
    case "exists":
      return actual !== undefined
    case "equals":
      return actual !== undefined && actual === value
    case "notEquals":
      return actual === undefined ? true : actual !== value
    case "in":
      return Array.isArray(value) && actual !== undefined && (value as Array<string | number>).includes(actual as string | number)
    case "notIn":
      return !(Array.isArray(value) && actual !== undefined && (value as Array<string | number>).includes(actual as string | number))
    case "contains":
      return typeof actual === "string" && typeof value === "string" && actual.includes(value)
    case "startsWith":
      return typeof actual === "string" && typeof value === "string" && actual.startsWith(value)
    case "greaterThan":
      return typeof actual === "number" && typeof value === "number" && actual > value
    case "lessThan":
      return typeof actual === "number" && typeof value === "number" && actual < value
    default:
      // Exhaustive per the ConditionOperator union — an unrecognized
      // operator string (e.g. from a malformed/forged policy payload)
      // falls through here and evaluates to false, never throws, never
      // executes anything.
      return false
  }
}

/**
 * Recursively evaluates a condition tree against a trusted context. Pure,
 * side-effect-free, cannot execute code. Depth is naturally bounded by
 * the JSON structure itself; policy-store.ts additionally rejects
 * pathologically deep/large condition trees before they ever reach here
 * (defense in depth against a maliciously large stored policy causing
 * excessive recursion).
 */
export function evaluateCondition(ctx: AuthorizationContext, node: ConditionNode | null | undefined): boolean {
  if (!node || typeof node !== "object") return true // absent condition = unconditionally matches (the scope/capability match already did the real filtering)

  if ("and" in node) {
    if (!Array.isArray(node.and)) return false
    return node.and.every((child) => evaluateCondition(ctx, child))
  }
  if ("or" in node) {
    if (!Array.isArray(node.or)) return false
    return node.or.some((child) => evaluateCondition(ctx, child))
  }
  if ("not" in node) {
    return !evaluateCondition(ctx, node.not)
  }
  if ("operator" in node && "attribute" in node) {
    return evaluateLeaf(ctx, node.operator, node.attribute, node.value)
  }
  return false // malformed node shape — never matches, never throws
}

/**
 * Validates that a JSON value is a well-formed ConditionNode BEFORE it is
 * ever stored (policy-store.ts's write path) — rejects anything with an
 * unrecognized attribute name, unrecognized operator, or structurally
 * invalid shape. This is the "malformed policy" guard the spec requires
 * (test scenario #25 "malformed policy").
 */
export function assertWellFormedCondition(node: unknown, depth = 0): void {
  if (depth > 12) throw new Error("Condition tree exceeds maximum nesting depth (12).")
  if (node === null || node === undefined) return
  if (typeof node !== "object" || Array.isArray(node)) {
    throw new Error("Condition node must be a plain object.")
  }
  const obj = node as Record<string, unknown>

  if ("and" in obj) {
    if (!Array.isArray(obj.and)) throw new Error('"and" must be an array of condition nodes.')
    for (const child of obj.and) assertWellFormedCondition(child, depth + 1)
    return
  }
  if ("or" in obj) {
    if (!Array.isArray(obj.or)) throw new Error('"or" must be an array of condition nodes.')
    for (const child of obj.or) assertWellFormedCondition(child, depth + 1)
    return
  }
  if ("not" in obj) {
    assertWellFormedCondition(obj.not, depth + 1)
    return
  }
  if ("operator" in obj && "attribute" in obj) {
    const operator = obj.operator
    const attribute = obj.attribute
    const VALID_OPERATORS: ConditionOperator[] = ["equals", "notEquals", "in", "notIn", "contains", "startsWith", "exists", "greaterThan", "lessThan"]
    if (typeof operator !== "string" || !VALID_OPERATORS.includes(operator as ConditionOperator)) {
      throw new Error(`Unrecognized condition operator: "${String(operator)}".`)
    }
    if (typeof attribute !== "string" || !Object.prototype.hasOwnProperty.call(ATTRIBUTE_RESOLVERS, attribute)) {
      throw new Error(`Unrecognized condition attribute: "${String(attribute)}".`)
    }
    if (operator !== "exists" && !("value" in obj)) {
      throw new Error(`Operator "${operator}" requires a "value" field.`)
    }
    return
  }
  throw new Error("Condition node must be one of: and, or, not, or a leaf with operator+attribute.")
}
