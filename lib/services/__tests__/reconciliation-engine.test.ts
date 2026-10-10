/**
 * Phase 10 — Reconciliation engine: modes, finding idempotency, allow-listed
 * repair + postcondition verification, run guard. Services are mocked; the
 * engine logic and fake DB carry the test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ReconciliationFindingStatus,
  ReconciliationMode,
  ReconciliationRunStatus,
} from "@prisma/client"

// ── Fake DB ──────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>
let runs: Row[] = []
let findings: Row[] = []
let provisioningRows: Row[] = []
let trialRows: Row[] = []
let grantRows: Row[] = []
let counter = 0

vi.mock("@/lib/db", () => {
  const now = new Date()
  const db = {
    reconciliationRun: {
      findFirst: async () => runs.find((r) => r.status === "RUNNING") ?? null,
      create: async (args: { data: Row }) => {
        const row = { id: `run_${++counter}`, status: "RUNNING", scanned: 0, findingsCount: 0, repairedCount: 0, skippedCount: 0, errorCount: 0, startedAt: now, ...args.data }
        runs.push(row)
        return { ...row }
      },
      update: async (args: { where: { id: string }; data: Row }) => {
        const row = runs.find((r) => r.id === args.where.id)!
        Object.assign(row, args.data)
        return { ...row }
      },
    },
    reconciliationFinding: {
      findUnique: async (args: { where: { findingKey?: string; id?: string } }) => {
        const row = args.where.findingKey
          ? findings.find((f) => f.findingKey === args.where.findingKey)
          : findings.find((f) => f.id === args.where.id)
        return row ? { ...row } : null
      },
      create: async (args: { data: Row }) => {
        const row = { id: `find_${++counter}`, status: "NEW", attempts: 0, ...args.data }
        findings.push(row)
        return { ...row }
      },
      update: async (args: { where: { findingKey?: string; id?: string }; data: Row }) => {
        const row = (args.where.findingKey
          ? findings.find((f) => f.findingKey === args.where.findingKey)
          : findings.find((f) => f.id === args.where.id)) as Row
        if (args.data.attempts && typeof args.data.attempts === "object" && "increment" in (args.data.attempts as object)) {
          const { attempts: _a, ...rest } = args.data
          row.attempts = (row.attempts as number) + (args.data.attempts as { increment: number }).increment
          Object.assign(row, rest)
        } else {
          Object.assign(row, args.data)
        }
        return { ...row }
      },
    },
    webhookEvent: {
      findMany: async (args: { where?: { status?: { in?: string[] } } }) =>
        args.where?.status?.in?.includes("FAILED")
          ? [{ source: "RAZORPAY", eventType: "subscription.charged", eventId: "evt_fail", status: "FAILED", errorMessage: "handler error", createdAt: new Date(Date.now() - 60_000) }]
          : [],
    },
    subscriptionCharge: { findMany: async () => [] },
    userSubscription: {
      findMany: async (args: { where?: { status?: { in?: string[] } } }) => {
        const wanted = args.where?.status?.in ?? []
        if (wanted.includes("CANCELED")) return [{ id: "sub_x", status: "CANCELED" }]
        return []
      },
    },
    subscriptionProvisioning: {
      findMany: async (args: { where?: { status?: { in?: string[] } } }) =>
        args.where?.status?.in?.includes("FAILED_RETRYABLE")
          ? provisioningRows.map((r) => ({ ...r }))
          : [],
      findUnique: async (args: { where: { dedupeKey?: string } }) => {
        const row = provisioningRows.find((r) => r.dedupeKey === args.where.dedupeKey)
        return row ? { ...row } : null
      },
    },
    entitlementGrant: {
      findMany: async (args: { where?: { status?: string } }) =>
        args.where?.status === "ACTIVE" ? grantRows.map((r) => ({ ...r })) : [],
      findUnique: async (args: { where: { id: string } }) => {
        const row = grantRows.find((g) => g.id === args.where.id)
        return row ? { ...row } : null
      },
    },
    trialEnrollment: {
      findMany: async () => trialRows.map((r) => ({ ...r })),
      findFirst: async (args: { where: { id: string; status: string } }) => {
        const row = trialRows.find((t) => t.id === args.where.id && t.status === args.where.status)
        return row ? { ...row } : null
      },
      findUnique: async (args: { where: { id: string } }) => {
        const row = trialRows.find((t) => t.id === args.where.id)
        return row ? { ...row } : null
      },
      update: async (args: { where: { id: string }; data: Row }) => {
        const row = trialRows.find((t) => t.id === args.where.id)!
        Object.assign(row, args.data)
        return { ...row }
      },
    },
    auditLog: { create: async () => ({}) },
  }
  return { __setFakeDb: true, db }
})

// ── Service mocks (repairs must go through EXISTING services) ────────────────

const provisionSpy = vi.fn(async (input: { subscriptionId: string; operation: string; periodRef?: string }, _actor?: string) => {
  const row = provisioningRows.find(
    (r) => r.subscriptionId === input.subscriptionId && r.operation === input.operation && (r.periodRef ?? undefined) === (input.periodRef ?? undefined),
  )
  if (!row) throw new Error("provisioning identity not found")
  row.status = "SUCCEEDED"
  return { dedupeKey: row.dedupeKey, status: "SUCCEEDED" }
})
const expireTrialsSpy = vi.fn(async (_now?: unknown, _actor?: unknown) => {
  for (const t of trialRows) if (t.status === "ACTIVE") t.status = "EXPIRED"
  return { expired: 1 }
})
const expireGrantSpy = vi.fn(async (_id?: unknown, _actor?: unknown, _reason?: unknown) => ({ status: "EXPIRED" }))

vi.mock("@/lib/services/subscription-provisioning", () => ({
  provisionSubscription: (i: never) => provisionSpy(i as never),
}))
vi.mock("@/lib/services/free-trial-service", () => ({
  expireExpiredTrials: (n: never, a: never) => expireTrialsSpy(n as never, a as never),
}))
vi.mock("@/lib/services/entitlement-service", () => ({
  expireEntitlementGrant: (id: never, actor: never, reason: never) => expireGrantSpy(id as never, actor as never, reason as never),
}))
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { runReconciliation, repairFindingById, SAFE_AUTO_REPAIRS } from "@/lib/services/reconciliation/engine"

function seedWorld() {
  // A failed retryable provisioning with its original identity
  provisioningRows = [{
    id: "prov_1",
    subscriptionId: "usub_1",
    operation: "INITIAL_ACTIVATION",
    periodRef: "ev_1",
    status: "FAILED_RETRYABLE",
    attemptCount: 1,
    errorCode: "PROVISIONING_TRANSIENT",
    dedupeKey: "dedupe_prov_1",
    updatedAt: new Date(),
  }]
  trialRows = [{ id: "trial_1", userId: "u1", status: "ACTIVE", expiresAt: new Date(Date.now() - 60_000) }]
  grantRows = []
  runs = []
  findings = []
}

beforeEach(() => {
  seedWorld()
  provisionSpy.mockClear()
  expireTrialsSpy.mockClear()
  expireGrantSpy.mockClear()
})

describe("modes", () => {
  it("DETECT_ONLY finds issues and performs NO repair mutations", async () => {
    const result = await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    expect(result.status).toBe(ReconciliationRunStatus.COMPLETED)
    expect(result.findings).toBeGreaterThanOrEqual(2) // provisioning + stale trial + provider-unavailable note
    expect(result.repaired).toBe(0)
    expect(provisionSpy).not.toHaveBeenCalled()
    expect(expireTrialsSpy).not.toHaveBeenCalled()
    const run = runs.find((r) => r.id === result.runId)!
    expect(run.status).toBe("COMPLETED")
    expect(run.scanned).toBeGreaterThan(0)
  })

  it("DRY_RUN proposes actions without executing them", async () => {
    const result = await runReconciliation({ mode: ReconciliationMode.DRY_RUN, actorId: "admin_1" })
    expect(result.proposed).toBeGreaterThanOrEqual(2)
    expect(result.repaired).toBe(0)
    expect(provisionSpy).not.toHaveBeenCalled()
    const proposed = findings.filter((f) => f.status === ReconciliationFindingStatus.ACTION_PROPOSED)
    expect(proposed.length).toBeGreaterThanOrEqual(2)
  })

  it("SAFE_AUTO_REPAIR runs ONLY the allow-listed repairs and verifies postconditions", async () => {
    const result = await runReconciliation({ mode: ReconciliationMode.SAFE_AUTO_REPAIR, actorId: "admin_1" })
    expect(result.repaired).toBeGreaterThanOrEqual(2)
    // Both idempotent domain services were used.
    expect(provisionSpy).toHaveBeenCalledTimes(1)
    expect(expireTrialsSpy).toHaveBeenCalled()
    const resolved = findings.filter((f) => f.status === ReconciliationFindingStatus.RESOLVED)
    expect(resolved.length).toBeGreaterThanOrEqual(2)
    for (const f of resolved) expect(f.actionStatus).toBe("VERIFIED")
  })

  it("MANUAL_INVESTIGATION escalates without any repair call", async () => {
    const result = await runReconciliation({ mode: ReconciliationMode.MANUAL_INVESTIGATION, actorId: "admin_1" })
    expect(result.escalated).toBeGreaterThanOrEqual(2)
    expect(provisionSpy).not.toHaveBeenCalled()
    expect(findings.some((f) => f.status === ReconciliationFindingStatus.ESCALATED)).toBe(true)
  })

  it("records the honest provider-evidence gap as INSUFFICIENT/UNAVAILABLE (never fabricated)", async () => {
    await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    const gap = findings.find((f) => f.category === "EXTERNAL_PROVIDER_UNAVAILABLE")
    expect(gap).toBeDefined()
    expect(gap!.severity).toBe("LOW")
    expect(gap!.observedValue).toMatchObject({ providerEvidence: "unavailable" })
  })
})

describe("finding idempotency across runs", () => {
  it("repeated runs update existing findings instead of duplicating them", async () => {
    await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    const firstCount = findings.length
    await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    expect(findings.length).toBe(firstCount) // unique findingKey upserts
    const key = findings.find((f) => f.entityId === "prov_1")!.findingKey as string
    expect(findings.filter((f) => f.findingKey === key)).toHaveLength(1)
  })

  it("a RESOLVED finding that reappears reopens as NEW", async () => {
    await runReconciliation({ mode: ReconciliationMode.SAFE_AUTO_REPAIR, actorId: "admin_1" })
    const provFinding = findings.find((f) => f.entityId === "prov_1")!
    expect(provFinding.status).toBe(ReconciliationFindingStatus.RESOLVED)
    // Simulate regression: provisioning fails again.
    provisioningRows[0].status = "FAILED_RETRYABLE"
    await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    const reopened = findings.find((f) => f.findingKey === provFinding.findingKey)!
    expect(reopened.status).toBe(ReconciliationFindingStatus.NEW)
    expect(reopened.attempts).toBeGreaterThan(0)
  })
})

describe("run guard and manual repair", () => {
  it("an active RUNNING run blocks a second concurrent run", async () => {
    runs = [{ id: "run_active", status: "RUNNING", scanned: 0, findingsCount: 0, repairedCount: 0, skippedCount: 0, errorCount: 0, startedAt: new Date(), mode: "DETECT_ONLY" }]
    const result = await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    expect(result.runId).toBe("run_active")
    expect(runs).toHaveLength(1) // no second run created
  })

  it("a stale RUNNING run is marked interrupted and a new run proceeds", async () => {
    runs = [{ id: "run_stale", status: "RUNNING", scanned: 0, findingsCount: 0, repairedCount: 0, skippedCount: 0, errorCount: 0, startedAt: new Date(Date.now() - 60 * 60_000), mode: "DETECT_ONLY" }]
    const result = await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    expect(result.runId).not.toBe("run_stale")
    expect(runs.find((r) => r.id === "run_stale")!.status).toBe("FAILED")
  })

  it("repairFindingById applies an allow-listed repair with verification", async () => {
    await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    const trialFinding = findings.find((f) => f.proposedAction === "EXPIRE_STALE_TRIALS")!
    const outcome = await repairFindingById(String(trialFinding.id), "admin_1")
    expect(outcome.outcome).toBe("RESOLVED")
    expect(trialRows[0].status).toBe("EXPIRED")
    expect(expireTrialsSpy).toHaveBeenCalled()
  })

  it("repairFindingById escalates findings with no safe action (never fabricates a repair)", async () => {
    await runReconciliation({ mode: ReconciliationMode.DETECT_ONLY, actorId: "admin_1" })
    const unsafe = findings.find((f) => f.proposedAction === null && f.category !== "EXTERNAL_PROVIDER_UNAVAILABLE")!
    const outcome = await repairFindingById(String(unsafe.id), "admin_1")
    expect(outcome.outcome).toBe("ESCALATED")
    expect(findings.find((f) => f.id === unsafe.id)!.status).toBe(ReconciliationFindingStatus.ESCALATED)
  })

  it("unknown finding id fails safely", async () => {
    await expect(repairFindingById("find_missing", "admin_1")).rejects.toThrow(/not found/i)
  })

  it("the allow-list contains only idempotent domain-service actions", () => {
    expect([...SAFE_AUTO_REPAIRS].sort()).toEqual([
      "EXPIRE_STALE_GRANT",
      "EXPIRE_STALE_TRIALS",
      "REPROCESS_PROVISIONING",
      "REVOKE_SUBSCRIPTION_GRANTS",
    ])
  })
})
