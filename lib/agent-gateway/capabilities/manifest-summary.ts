/**
 * lib/agent-gateway/capabilities/manifest-summary.ts
 *
 * Phase 12 (supply chain) — a deterministic, security-relevant summary of
 * the capability surface and its fingerprint.
 *
 * The summary covers everything that decides what an agent can do and
 * what it can see: id / version / status / exposure / risk tier, adapter
 * binding, permission, required identity, resource locator, idempotency,
 * async support, reversibility and recovery mapping, content trust, and the
 * STRUCTURE of the input and output schemas (field names, types, bounds,
 * strictness). Descriptions and other prose are excluded on purpose.
 *
 * Two uses:
 *   - manifest.lock.json pins the reviewed summary of the core manifest; a
 *     test fails on any drift, so widening a capability (new input field,
 *     higher exposure, removed bound) is always an explicit, reviewed diff;
 *   - the fingerprint of the LIVE registry is appended to the audit ledger
 *     whenever it changes (capability_registry.loaded), so the evidence
 *     chain records which capability surface was in force.
 */
import { createHash } from "crypto"
import { canonicalJson } from "../approvals/canonical-json"
import { resolveRecoverySpec } from "../recovery/spec"
import type { CapabilityDefinition } from "./types"

type ZodDef = { typeName?: string; [key: string]: unknown }

function checksOf(checks: unknown): string[] {
  if (!Array.isArray(checks)) return []
  return checks
    .map((c: { kind?: string; value?: unknown; inclusive?: boolean; regex?: RegExp }) => {
      if (c.kind === "regex" && c.regex) return `regex:${c.regex.source}`
      if (c.value !== undefined) return `${c.kind}:${String(c.value)}${c.inclusive === false ? "(exclusive)" : ""}`
      return String(c.kind)
    })
    .sort()
}

/** A structural description of a zod schema (zod v3 classic API). */
export function describeSchema(schema: unknown, depth = 0): unknown {
  if (schema === null || schema === undefined) return null
  if (depth > 16) return { type: "too-deep" }
  const def = (schema as { _def?: ZodDef })._def
  if (!def || typeof def.typeName !== "string") return { type: "unknown" }
  switch (def.typeName) {
    case "ZodObject": {
      const shape = (def.shape as () => Record<string, unknown>)()
      return {
        type: "object",
        unknownKeys: def.unknownKeys ?? "strip",
        fields: Object.fromEntries(Object.keys(shape).sort().map((k) => [k, describeSchema(shape[k], depth + 1)])),
      }
    }
    case "ZodString":
      return { type: "string", checks: checksOf(def.checks) }
    case "ZodNumber":
      return { type: "number", checks: checksOf(def.checks) }
    case "ZodBoolean":
      return { type: "boolean" }
    case "ZodDate":
      return { type: "date" }
    case "ZodEnum":
      return { type: "enum", values: [...(def.values as string[])].sort() }
    case "ZodNativeEnum":
      return { type: "enum", values: Object.values(def.values as Record<string, string>).map(String).sort() }
    case "ZodLiteral":
      return { type: "literal", value: def.value as string | number | boolean }
    case "ZodArray":
      return {
        type: "array",
        items: describeSchema(def.type, depth + 1),
        min: (def.minLength as { value?: number } | null)?.value ?? null,
        max: (def.maxLength as { value?: number } | null)?.value ?? null,
      }
    case "ZodOptional":
      return { optional: describeSchema(def.innerType, depth + 1) }
    case "ZodNullable":
      return { nullable: describeSchema(def.innerType, depth + 1) }
    case "ZodDefault":
      return { withDefault: describeSchema(def.innerType, depth + 1) }
    case "ZodUnion":
      return { union: (def.options as unknown[]).map((o) => describeSchema(o, depth + 1)) }
    case "ZodEffects":
      return { effects: describeSchema(def.schema, depth + 1) }
    case "ZodRecord":
      return { type: "record", values: describeSchema(def.valueType, depth + 1) }
    default:
      return { type: def.typeName }
  }
}

export function summarizeCapability(def: CapabilityDefinition): Record<string, unknown> {
  const recovery = resolveRecoverySpec(def)
  return {
    id: def.id,
    version: def.version,
    domain: def.domain,
    status: def.status,
    exposure: def.exposure,
    operationType: def.operationType,
    adapterKey: def.executionReference?.adapterKey ?? null,
    permission: def.permission.permission,
    requiredIdentityContext: [...def.requiredIdentityContext].sort(),
    resource: { type: def.resource.resourceType, locator: def.resource.resourceLocator ?? null },
    idempotency: {
      requiresKey: def.idempotency.requiresIdempotencyKey,
      retrySafe: def.idempotency.retrySafe,
      class: def.idempotency.class,
      scope: def.idempotency.idempotencyScope ?? null,
    },
    async: { mode: def.async.executionMode, asyncSupported: def.async.asyncSupported === true, cooperativeCancellation: def.async.cooperativeCancellation === true },
    reversibility: def.rollback.reversibility,
    recovery: recovery
      ? {
          class: recovery.class,
          capabilityId: recovery.capabilityId ?? null,
          capabilityVersion: recovery.capabilityVersion ?? null,
          inputMapping: recovery.inputMapping ?? null,
          manual: recovery.manualRecoveryRequired,
        }
      : null,
    contentTrust: def.contentTrust ?? "THIRD_PARTY_CONTENT",
    input: describeSchema(def.inputSchema),
    output: describeSchema(def.outputSchema),
  }
}

export const MANIFEST_SUMMARY_VERSION = 1

export function summarizeManifest(defs: readonly CapabilityDefinition[]): Array<Record<string, unknown>> {
  return [...defs].sort((a, b) => (a.id === b.id ? a.version - b.version : a.id < b.id ? -1 : 1)).map(summarizeCapability)
}

export function manifestFingerprint(defs: readonly CapabilityDefinition[]): string {
  return createHash("sha256").update(`abhibhi.capabilities.v${MANIFEST_SUMMARY_VERSION}\n${canonicalJson(summarizeManifest(defs))}`, "utf8").digest("hex")
}
