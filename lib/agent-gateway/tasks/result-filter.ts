/**
 * lib/agent-gateway/tasks/result-filter.ts
 *
 * What may be stored and later shown to the agent: only the value the
 * capability's Phase 3 `outputSchema` parses (the resolver already enforced
 * it; this re-checks as defense in depth), canonical-JSON serializable, and
 * within the configured size limit. Anything else is a failed attempt and
 * nothing is stored.
 */
import type { Prisma } from "@prisma/client"
import type { CapabilityDefinition } from "../capabilities/types"
import { canonicalJson } from "../approvals/canonical-json"

export type ResultFilterOutcome =
  | { ok: true; value: Prisma.InputJsonValue }
  | { ok: false; detailCode: "RESULT_SCHEMA" | "RESULT_NOT_SERIALIZABLE" | "RESULT_TOO_LARGE" }

export function filterTaskResult(capability: CapabilityDefinition, output: unknown, maxBytes: number): ResultFilterOutcome {
  let value: unknown = output
  if (capability.outputSchema) {
    const parsed = capability.outputSchema.safeParse(output)
    if (!parsed.success) return { ok: false, detailCode: "RESULT_SCHEMA" }
    value = parsed.data
  }
  let canonical: string
  try {
    canonical = canonicalJson(value)
  } catch {
    return { ok: false, detailCode: "RESULT_NOT_SERIALIZABLE" }
  }
  if (Buffer.byteLength(canonical, "utf8") > maxBytes) return { ok: false, detailCode: "RESULT_TOO_LARGE" }
  return { ok: true, value: JSON.parse(canonical) as Prisma.InputJsonValue }
}
