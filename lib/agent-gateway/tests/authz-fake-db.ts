/**
 * lib/agent-gateway/tests/authz-fake-db.ts
 *
 * In-memory fake of the Prisma client surface used by
 * lib/agent-gateway/authorization/policy-store.ts (`agentPolicy` /
 * `agentPolicyVersion`), mirroring the exact conventions of
 * lib/agent-gateway/tests/fake-db.ts (Phase 2) and
 * lib/agent-gateway/tests/execution-fake-db.ts (Phase 4) — same
 * disclosed limitation (no live Postgres in this environment; this fake
 * proves the STORE's query construction and translation logic, not
 * Postgres behavior itself), same real (in-memory) `$transaction` with
 * snapshot/rollback semantics.
 */
import { vi } from "vitest"
import { Prisma } from "@prisma/client"

/**
 * Real Prisma/Postgres stores `Prisma.JsonNull` as SQL NULL and reads it
 * back as plain `null` — it is a write-time sentinel only, never a value
 * that survives a round trip. This fake must replicate that unwrapping;
 * storing the sentinel object verbatim (as a naive fake would) diverges
 * from real behavior and was caught by this suite's own rollback test.
 */
function unwrapJsonInput(value: unknown): unknown {
  return value === Prisma.JsonNull || value === Prisma.DbNull || value === Prisma.AnyNull ? null : value
}

export interface FakeAgentPolicyRow {
  id: string
  name: string
  description: string | null
  enabled: boolean
  priority: number
  createdAt: Date
  updatedAt: Date
  createdById: string
  currentVersionId: string | null
}

export interface FakeAgentPolicyVersionRow {
  id: string
  policyId: string
  version: number
  status: "ACTIVE" | "DISABLED" | "SUPERSEDED"
  effect: "ALLOW" | "DENY" | "REQUIRES_APPROVAL"
  scope: "GLOBAL" | "OWNER" | "TEAM" | "CONNECTION" | "CAPABILITY" | "RESOURCE_TYPE" | "RESOURCE" | "ENVIRONMENT"
  scopeValue: string | null
  capabilityId: string | null
  conditions: unknown
  riskConstraint: string | null
  approvalRequirement: boolean
  note: string | null
  createdAt: Date
  createdById: string
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

export function createAuthzFakeDb() {
  const policies = new Map<string, FakeAgentPolicyRow>()
  const versions = new Map<string, FakeAgentPolicyVersionRow>()

  function withPolicy(version: FakeAgentPolicyVersionRow) {
    const policy = policies.get(version.policyId)
    return { ...version, policy: policy ? { name: policy.name, enabled: policy.enabled, priority: policy.priority } : undefined }
  }

  const client = {
    agentPolicy: {
      create: vi.fn(async ({ data }: { data: Partial<FakeAgentPolicyRow> }) => {
        const now = new Date()
        const row: FakeAgentPolicyRow = {
          id: nextId("policy"),
          name: data.name ?? "",
          description: data.description ?? null,
          enabled: data.enabled ?? true,
          priority: data.priority ?? 0,
          createdAt: now,
          updatedAt: now,
          createdById: data.createdById!,
          currentVersionId: null,
        }
        policies.set(row.id, row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeAgentPolicyRow> }) => {
        const row = policies.get(where.id)
        if (!row) throw new Error("policy not found")
        const updated = { ...row, ...data, updatedAt: new Date() }
        policies.set(where.id, updated)
        return updated
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => policies.get(where.id) ?? null),
      // Phase 10 governance lists.
      findMany: vi.fn(async ({ where, skip, take }: { where?: { enabled?: boolean }; orderBy?: unknown; skip?: number; take?: number } = {}) => {
        const rows = Array.from(policies.values())
          .filter((p) => where?.enabled === undefined || p.enabled === where.enabled)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
        const start = skip ?? 0
        return rows.slice(start, take === undefined ? rows.length : start + take)
      }),
      count: vi.fn(async ({ where }: { where?: { enabled?: boolean } } = {}) => Array.from(policies.values()).filter((p) => where?.enabled === undefined || p.enabled === where.enabled).length),
    },
    agentPolicyVersion: {
      create: vi.fn(async ({ data }: { data: Partial<FakeAgentPolicyVersionRow> }) => {
        // @@unique([policyId, version]) — same P2002 shape as Prisma.
        if (Array.from(versions.values()).some((v) => v.policyId === data.policyId && v.version === data.version)) {
          throw Object.assign(new Error("Unique constraint failed on the fields: (`policyId`,`version`)"), { code: "P2002" })
        }
        const now = new Date()
        const row: FakeAgentPolicyVersionRow = {
          id: nextId("policyver"),
          policyId: data.policyId!,
          version: data.version!,
          status: (data.status as FakeAgentPolicyVersionRow["status"]) ?? "ACTIVE",
          effect: data.effect as FakeAgentPolicyVersionRow["effect"],
          scope: data.scope as FakeAgentPolicyVersionRow["scope"],
          scopeValue: data.scopeValue ?? null,
          capabilityId: data.capabilityId ?? null,
          conditions: unwrapJsonInput(data.conditions) ?? null,
          riskConstraint: (data.riskConstraint as string | null) ?? null,
          approvalRequirement: data.approvalRequirement ?? false,
          note: data.note ?? null,
          createdAt: now,
          createdById: data.createdById!,
        }
        versions.set(row.id, row)
        return row
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { policyId: string; status: string }; data: Partial<FakeAgentPolicyVersionRow> }) => {
        let count = 0
        for (const [id, row] of versions) {
          if (row.policyId !== where.policyId || row.status !== where.status) continue
          versions.set(id, { ...row, ...data })
          count += 1
        }
        return { count }
      }),
      findFirst: vi.fn(async ({ where, orderBy }: { where: { policyId: string }; orderBy?: { version: "desc" } }) => {
        const rows = Array.from(versions.values()).filter((v) => v.policyId === where.policyId)
        if (rows.length === 0) return null
        if (orderBy?.version === "desc") rows.sort((a, b) => b.version - a.version)
        return rows[0]
      }),
      findUnique: vi.fn(async ({ where }: { where: { policyId_version: { policyId: string; version: number } } }) => {
        const target = where.policyId_version
        return Array.from(versions.values()).find((v) => v.policyId === target.policyId && v.version === target.version) ?? null
      }),
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          skip,
          take,
        }: {
          where?: { status?: string; policyId?: string; id?: { in: string[] }; policy?: { enabled?: boolean } }
          orderBy?: { version?: "asc" | "desc" }
          skip?: number
          take?: number
        } = {}) => {
          let rows = Array.from(versions.values())
          if (where?.status) rows = rows.filter((r) => r.status === where.status)
          if (where?.policyId) rows = rows.filter((r) => r.policyId === where.policyId)
          if (where?.id?.in) rows = rows.filter((r) => where.id!.in.includes(r.id))
          if (where?.policy?.enabled !== undefined) {
            rows = rows.filter((r) => policies.get(r.policyId)?.enabled === where.policy!.enabled)
          }
          if (orderBy?.version) rows.sort((a, b) => (orderBy.version === "desc" ? b.version - a.version : a.version - b.version))
          const start = skip ?? 0
          return rows.slice(start, take === undefined ? rows.length : start + take).map(withPolicy)
        }
      ),
      count: vi.fn(async ({ where }: { where?: { status?: string; policyId?: string } } = {}) =>
        Array.from(versions.values()).filter((r) => (!where?.status || r.status === where.status) && (!where?.policyId || r.policyId === where.policyId)).length
      ),
    },
    // Same real (in-memory) transactional snapshot/rollback + serialization
    // semantics as tests/fake-db.ts — see that file's comment for the full
    // rationale (avoids JS cooperative-scheduling interleaving artifacts a
    // naive fake would otherwise introduce).
    $transaction: (() => {
      let queue: Promise<unknown> = Promise.resolve()
      const run = vi.fn(async (arg: unknown) => {
        const previous = queue
        let release: () => void
        const next = new Promise<void>((resolve) => {
          release = resolve
        })
        queue = previous.then(() => next)
        await previous

        const snapshot = { policies: new Map(policies), versions: new Map(versions) }
        try {
          if (Array.isArray(arg)) {
            const results: unknown[] = []
            for (const p of arg as Promise<unknown>[]) results.push(await p)
            return results
          }
          return await (arg as (tx: typeof client) => Promise<unknown>)(client)
        } catch (err) {
          policies.clear()
          for (const [k, v] of snapshot.policies) policies.set(k, v)
          versions.clear()
          for (const [k, v] of snapshot.versions) versions.set(k, v)
          throw err
        } finally {
          release!()
        }
      })
      return run
    })(),
  }

  return {
    client,
    _policies: policies,
    _versions: versions,
  }
}
