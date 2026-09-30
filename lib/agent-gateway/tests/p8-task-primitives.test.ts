/**
 * Phase 8 — Section A (unit): state machine, retry classification, ids,
 * time rules (incl. exact boundaries), result filtering, configuration,
 * capability async declaration and queue payload contract.
 */
import { describe, expect, it } from "vitest"
import { AGENT_TASK_STATUSES, type AgentTaskStatus } from "../tasks/types"
import { assertLegalTaskTransition, isLegalTaskTransition, isTerminalTask } from "../tasks/state-machine"
import { backoffMs, classifyRetry, decideAfterFailure, isTransientExecutionCode, maxAttemptsFor } from "../tasks/retry-policy"
import { generateTaskRef, idempotencyScopeFor, isValidIdempotencyKey, isValidTaskRef, jobIdFor, operationKeyFor } from "../tasks/ids"
import { dueTimeTransition } from "../tasks/lifecycle"
import { filterTaskResult } from "../tasks/result-filter"
import { DEFAULT_TASK_ENGINE_CONFIG } from "../tasks/config"
import { TASK_JOB_PAYLOAD_SCHEMA } from "../tasks/queue"
import { CORE_CAPABILITY_MANIFEST } from "../capabilities/manifest"
import { CapabilityRegistry } from "../capabilities/registry"
import { FIXTURE_CONDITIONAL, FIXTURE_COOPERATIVE, FIXTURE_KEYED, FIXTURE_NO_RETRY, TEST_CONFIG } from "./task-test-kit"
import { cap } from "./p7-helpers"
import type { AgentTaskRow } from "../tasks/types"

const LEGAL: Record<AgentTaskStatus, AgentTaskStatus[]> = {
  QUEUED: ["STARTING", "CANCELLED", "EXPIRED", "FAILED"],
  STARTING: ["RUNNING", "CANCELLED", "EXPIRED", "FAILED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLING", "TIMED_OUT"],
  CANCELLING: ["CANCELLED", "SUCCEEDED", "FAILED", "TIMED_OUT"],
  FAILED: ["RETRY_QUEUED"],
  RETRY_QUEUED: ["STARTING", "CANCELLED", "EXPIRED", "FAILED"],
  SUCCEEDED: [],
  CANCELLED: [],
  EXPIRED: [],
  TIMED_OUT: [],
}

describe("A.3/A.4 — task state machine", () => {
  it("permits exactly the documented transitions (all 100 pairs)", () => {
    for (const from of AGENT_TASK_STATUSES) {
      for (const to of AGENT_TASK_STATUSES) {
        expect(isLegalTaskTransition(from, to), `${from}->${to}`).toBe(LEGAL[from].includes(to))
      }
    }
  })
  it("terminal states have no exits; FAILED is terminal only without a scheduled retry", () => {
    for (const s of ["SUCCEEDED", "CANCELLED", "EXPIRED", "TIMED_OUT"] as const) {
      expect(isTerminalTask(s, false)).toBe(true)
      expect(() => assertLegalTaskTransition(s, "RUNNING")).toThrow("Illegal task transition")
    }
    expect(isTerminalTask("FAILED", false)).toBe(true)
    expect(isTerminalTask("FAILED", true)).toBe(false)
    for (const s of ["QUEUED", "STARTING", "RUNNING", "CANCELLING", "RETRY_QUEUED"] as const) expect(isTerminalTask(s, false)).toBe(false)
  })
  it("cannot skip the claim: QUEUED/RETRY_QUEUED never go straight to RUNNING or SUCCEEDED", () => {
    for (const from of ["QUEUED", "RETRY_QUEUED"] as const) {
      expect(isLegalTaskTransition(from, "RUNNING")).toBe(false)
      expect(isLegalTaskTransition(from, "SUCCEEDED")).toBe(false)
    }
  })
})

describe("A.13 — retry classification from Phase 3/4 metadata", () => {
  it("classifies every manifest capability", () => {
    const byId = Object.fromEntries(CORE_CAPABILITY_MANIFEST.map((c) => [c.id, classifyRetry(c)]))
    expect(byId).toEqual({
      "products.list": "SAFE_RETRY",
      "products.get": "SAFE_RETRY",
      "subscriptions.get": "SAFE_RETRY",
      "tickets.list": "SAFE_RETRY",
      "products.createDraft": "CONDITIONAL_RETRY",
      "coupons.create": "CONDITIONAL_RETRY",
      "products.updatePricing": "CONDITIONAL_RETRY",
      "refunds.process": "NO_RETRY",
    })
  })
  it("fixtures: conditional, irreversible, keyed, cooperative", () => {
    expect(classifyRetry(FIXTURE_CONDITIONAL)).toBe("CONDITIONAL_RETRY")
    expect(classifyRetry(FIXTURE_NO_RETRY)).toBe("NO_RETRY")
    expect(classifyRetry(FIXTURE_KEYED)).toBe("CONDITIONAL_RETRY")
    expect(classifyRetry(FIXTURE_COOPERATIVE)).toBe("SAFE_RETRY")
  })
  it("payments / critical / unsafe-without-key / missing metadata are NO_RETRY", () => {
    expect(classifyRetry({ ...FIXTURE_CONDITIONAL, domain: "payments" })).toBe("NO_RETRY")
    expect(classifyRetry({ ...FIXTURE_CONDITIONAL, sideEffects: { effects: ["external payment capture"] } })).toBe("NO_RETRY")
    expect(classifyRetry({ ...FIXTURE_CONDITIONAL, operationType: "CRITICAL" })).toBe("NO_RETRY")
    expect(classifyRetry({ ...FIXTURE_CONDITIONAL, idempotency: { ...FIXTURE_CONDITIONAL.idempotency, retrySafe: false } })).toBe("NO_RETRY")
    expect(classifyRetry({ ...FIXTURE_CONDITIONAL, idempotency: undefined as never })).toBe("NO_RETRY")
    expect(classifyRetry({ ...FIXTURE_CONDITIONAL, rollback: undefined as never })).toBe("NO_RETRY")
  })
  it("attempts and exponential backoff", () => {
    expect(maxAttemptsFor("SAFE_RETRY")).toBe(3)
    expect(maxAttemptsFor("CONDITIONAL_RETRY")).toBe(3)
    expect(maxAttemptsFor("NO_RETRY")).toBe(1)
    expect([1, 2, 3].map(backoffMs)).toEqual([1000, 2000, 4000])
  })
  it("failure decisions", () => {
    const base = { attempts: 1, maxAttempts: 3, transient: true, preDispatch: false }
    expect(decideAfterFailure({ ...base, retryClass: "SAFE_RETRY" })).toEqual({ retry: true })
    expect(decideAfterFailure({ ...base, retryClass: "SAFE_RETRY", transient: false })).toEqual({ retry: false, errorCode: "EXECUTION_FAILED" })
    expect(decideAfterFailure({ ...base, retryClass: "SAFE_RETRY", attempts: 3 })).toEqual({ retry: false, errorCode: "RETRY_EXHAUSTED" })
    expect(decideAfterFailure({ ...base, retryClass: "CONDITIONAL_RETRY" })).toEqual({ retry: false, errorCode: "EXECUTION_FAILED" })
    expect(decideAfterFailure({ ...base, retryClass: "CONDITIONAL_RETRY", preDispatch: true })).toEqual({ retry: true })
    expect(decideAfterFailure({ ...base, retryClass: "NO_RETRY", preDispatch: true })).toEqual({ retry: false, errorCode: "EXECUTION_FAILED" })
  })
  it("only temporary Phase 4 codes are transient", () => {
    for (const c of ["EXECUTION_UNAVAILABLE", "INTERNAL_ERROR", "TIMEOUT"]) expect(isTransientExecutionCode(c)).toBe(true)
    for (const c of ["INVALID_INPUT", "RESOURCE_NOT_FOUND", "FORBIDDEN", "CONFLICT", "CANCELLED", "IDEMPOTENCY_CONFLICT", undefined]) expect(isTransientExecutionCode(c)).toBe(false)
  })
})

describe("A.1/A.5 — task identity", () => {
  it("task refs are 128-bit random, well-formed and distinct", () => {
    const refs = new Set(Array.from({ length: 200 }, generateTaskRef))
    expect(refs.size).toBe(200)
    for (const r of refs) expect(isValidTaskRef(r)).toBe(true)
    for (const bad of ["", "atk_", "atk_XYZ", "task_1", "atk_" + "0".repeat(31), 42, null]) expect(isValidTaskRef(bad)).toBe(false)
  })
  it("job ids are deterministic per attempt and contain no ':' (BullMQ custom-id rule)", () => {
    expect(jobIdFor("t1", 1)).toBe("t1-a1")
    expect(jobIdFor("t1", 1)).toBe(jobIdFor("t1", 1))
    expect(jobIdFor("t1", 2)).not.toBe(jobIdFor("t1", 1))
    expect(jobIdFor("clx9", 3)).not.toContain(":")
  })
  it("idempotency keys: charset/length enforced and scoped to the connection", () => {
    expect(isValidIdempotencyKey("abc-123_45")).toBe(true)
    for (const bad of ["short", "x".repeat(129), "has space!!", "semi;colon", 12345678]) expect(isValidIdempotencyKey(bad)).toBe(false)
    expect(idempotencyScopeFor("conn_1", "key-00001")).not.toBe(idempotencyScopeFor("conn_2", "key-00001"))
  })
  it("operation keys change with every identity field", () => {
    const base = { connectionId: "c", capabilityId: "products.get", capabilityVersion: 1, resourceType: "Product", resourceId: "p1", inputDigest: "d" }
    const k = operationKeyFor(base)
    expect(operationKeyFor({ ...base })).toBe(k)
    for (const change of [{ connectionId: "c2" }, { capabilityId: "products.list" }, { capabilityVersion: 2 }, { resourceId: "p2" }, { resourceType: null }, { inputDigest: "e" }]) {
      expect(operationKeyFor({ ...base, ...change })).not.toBe(k)
    }
  })
})

function row(overrides: Partial<AgentTaskRow>): AgentTaskRow {
  return {
    id: "t1",
    taskRef: generateTaskRef(),
    requestId: "req_1",
    connectionId: "conn_1",
    agentId: null,
    ownerId: "owner_1",
    teamId: null,
    capabilityId: "products.get",
    capabilityVersion: 1,
    adapterId: "products.getAdapter",
    environment: "development",
    resourceType: "Product",
    resourceId: "p1",
    input: { id: "p1" },
    inputDigest: "x",
    idempotencyKey: null,
    idempotencyScope: null,
    activeOperationKey: null,
    approvalRequestId: null,
    authorizationPolicyRef: "none",
    autonomyPolicyVersion: null,
    retryClass: "SAFE_RETRY",
    status: "QUEUED",
    attempts: 0,
    maxAttempts: 3,
    retryScheduled: false,
    cancelRequestedAt: null,
    queuedAt: new Date("2026-10-02T10:00:00.000Z"),
    attemptStartedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    finishedAt: null,
    expiresAt: new Date("2026-10-02T11:00:00.000Z"),
    result: null,
    resultRemovedAt: null,
    errorCode: null,
    errorDetailCode: null,
    createdAt: new Date("2026-10-02T10:00:00.000Z"),
    updatedAt: new Date("2026-10-02T10:00:00.000Z"),
    ...overrides,
  } as AgentTaskRow
}

describe("A.10/A.11, F — time rules and exact boundaries", () => {
  const cfg = TEST_CONFIG
  const at = (iso: string) => new Date(iso)
  it("overall deadline is exclusive: 1 ms before is fine, the instant itself expires", () => {
    const t = row({ expiresAt: at("2026-10-02T10:10:00.000Z") })
    expect(dueTimeTransition(t, cfg, at("2026-10-02T10:09:59.999Z"))).toBeNull()
    expect(dueTimeTransition(t, cfg, at("2026-10-02T10:10:00.000Z"))).toEqual({ to: "EXPIRED", errorCode: "TASK_EXPIRED" })
  })
  it("queue timeout is measured from entry into QUEUED/RETRY_QUEUED", () => {
    const t = row({ status: "RETRY_QUEUED", queuedAt: at("2026-10-02T10:00:00.000Z") })
    expect(dueTimeTransition(t, cfg, new Date(t.queuedAt.getTime() + cfg.queueTimeoutMs - 1))).toBeNull()
    expect(dueTimeTransition(t, cfg, new Date(t.queuedAt.getTime() + cfg.queueTimeoutMs))).toEqual({ to: "EXPIRED", errorCode: "TASK_EXPIRED" })
  })
  it("execution timeout is measured from the attempt's RUNNING start", () => {
    const start = at("2026-10-02T10:01:00.000Z")
    const t = row({ status: "RUNNING", attemptStartedAt: start, attempts: 1 })
    expect(dueTimeTransition(t, cfg, new Date(start.getTime() + cfg.executionTimeoutMs - 1))).toBeNull()
    expect(dueTimeTransition(t, cfg, new Date(start.getTime() + cfg.executionTimeoutMs))).toEqual({ to: "TIMED_OUT", errorCode: "TASK_TIMEOUT" })
    expect(dueTimeTransition({ ...t, status: "CANCELLING" }, cfg, t.expiresAt)).toEqual({ to: "TIMED_OUT", errorCode: "TASK_TIMEOUT" })
  })
  it("terminal tasks are never touched by time rules", () => {
    for (const s of ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "TIMED_OUT"] as const) {
      expect(dueTimeTransition(row({ status: s }), cfg, at("2030-01-01T00:00:00.000Z"))).toBeNull()
    }
  })
})

describe("A.15 — result filtering", () => {
  const products = cap("products.get")
  it("keeps only what the output contract parses", () => {
    const res = filterTaskResult(products, { id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" }, 2048)
    expect(res).toEqual({ ok: true, value: { id: "p1", name: "A", slug: "a", status: "AVAILABLE", type: "SAAS" } })
  })
  it("rejects contract violations, non-serializable values and oversize results", () => {
    expect(filterTaskResult(products, { id: "p1" }, 2048)).toEqual({ ok: false, detailCode: "RESULT_SCHEMA" })
    expect(filterTaskResult({ ...products, outputSchema: null }, { n: NaN }, 2048)).toEqual({ ok: false, detailCode: "RESULT_NOT_SERIALIZABLE" })
    expect(filterTaskResult({ ...products, outputSchema: null }, { s: "x".repeat(5000) }, 2048)).toEqual({ ok: false, detailCode: "RESULT_TOO_LARGE" })
  })
})

describe("configuration, capability declaration and queue payload", () => {
  it("documented defaults, tasks disabled by default", () => {
    expect(DEFAULT_TASK_ENGINE_CONFIG).toMatchObject({
      enabled: false,
      queueTimeoutMs: 900_000,
      executionTimeoutMs: 60_000,
      deadlineMs: 3_600_000,
      enqueueTimeoutMs: 5_000,
      maxResultBytes: 262_144,
      resultRetentionMs: 604_800_000,
      taskRetentionMs: 2_592_000_000,
    })
  })
  it("exactly the four READ capabilities declare async support; SYNC stays their default mode", () => {
    const asyncIds = CORE_CAPABILITY_MANIFEST.filter((c) => c.async.asyncSupported).map((c) => c.id)
    expect(asyncIds).toEqual(["products.list", "products.get", "subscriptions.get", "tickets.list"])
    for (const c of CORE_CAPABILITY_MANIFEST) expect(c.async.executionMode).toBe("SYNC")
    for (const c of CORE_CAPABILITY_MANIFEST.filter((x) => x.async.asyncSupported)) expect(c.async.cooperativeCancellation).toBeFalsy()
  })
  it("the registry rejects async support on FORBIDDEN / DISABLED / unwired capabilities", () => {
    const reg = new CapabilityRegistry()
    const asyncOn = { executionMode: "SYNC" as const, asyncSupported: true }
    expect(() => reg.register({ ...cap("refunds.process"), async: asyncOn })).toThrow(/asyncSupported/)
    expect(() => reg.register({ ...cap("products.createDraft"), async: asyncOn, executionReference: null })).toThrow(/asyncSupported/)
    expect(() => reg.register({ ...cap("products.get"), id: "products.getDisabled", status: "DISABLED", async: asyncOn })).toThrow(/asyncSupported/)
  })
  it("the job payload is references only and strictly shaped", () => {
    const good = { taskId: "t1", attempt: 1, capabilityId: "products.get", capabilityVersion: 1, adapterId: "products.getAdapter", environment: "development", idempotencyRef: null }
    expect(TASK_JOB_PAYLOAD_SCHEMA.safeParse(good).success).toBe(true)
    expect(TASK_JOB_PAYLOAD_SCHEMA.safeParse({ ...good, input: { id: "p1" } }).success).toBe(false)
    expect(TASK_JOB_PAYLOAD_SCHEMA.safeParse({ ...good, ownerId: "owner_2" }).success).toBe(false)
    expect(TASK_JOB_PAYLOAD_SCHEMA.safeParse({ ...good, token: "agw_x" }).success).toBe(false)
    expect(TASK_JOB_PAYLOAD_SCHEMA.safeParse({ ...good, attempt: 0 }).success).toBe(false)
  })
})
