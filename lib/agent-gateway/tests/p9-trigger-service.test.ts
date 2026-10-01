/**
 * Phase 9 — human-side trigger management (TriggerService): server-derived
 * security context, validation, forged fields, webhook secret handling,
 * lifecycle transitions and optimistic concurrency.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { buildTriggerKit, EVENT_TRIGGER, SCHEDULE_TRIGGER, WEBHOOK_TRIGGER } from "./trigger-test-kit"

type Kit = Awaited<ReturnType<typeof buildTriggerKit>>
let k: Kit

beforeEach(async () => {
  k = await buildTriggerKit()
})

describe("Phase 9 A — creation derives every security field on the server", () => {
  it("copies owner, team and environment from the connection and pins the capability version", async () => {
    k.fake.updateConnection("conn_1", { ownerId: "owner_1", teamId: "team_7" })
    const { trigger, webhookSecret } = await k.triggers.create(EVENT_TRIGGER, "admin_1")
    expect(webhookSecret).toBeUndefined()
    expect(trigger).toMatchObject({
      type: "EVENT",
      status: "DRAFT",
      version: 1,
      ownerId: "owner_1",
      teamId: "team_7",
      environment: "development",
      capabilityId: "products.get",
      capabilityVersion: 1,
      bindResource: true,
      concurrency: "DROP_WHILE_RUNNING",
      event: { eventType: "PRODUCT_UPDATED", resourceId: null, actorScope: "OWNER" },
    })
    expect(trigger.triggerRef).toMatch(/^trg_[0-9a-f]{32}$/)
    expect(k.triggerRow(trigger.triggerRef).createdById).toBe("admin_1")
  })

  it("rejects forged security fields (strict schema)", async () => {
    for (const forged of [
      { ownerId: "owner_2" },
      { environment: "production" },
      { status: "ACTIVE" },
      { capabilityVersion: 2 },
      { adapterId: "x" },
      { teamId: "team_x" },
      { webhookSecretRef: "abc" },
      { version: 9 },
      { createdById: "someone" },
    ]) {
      expect(await k.catchTrigger(k.triggers.create({ ...WEBHOOK_TRIGGER, ...forged }, "admin_1")), JSON.stringify(forged)).toBe("TRIGGER_VALIDATION_FAILED")
    }
    expect(k.fake._triggers.size).toBe(0)
  })

  it("only async-capable, agent-available, current capabilities can be triggered", async () => {
    for (const capabilityId of ["coupons.create", "refunds.process", "products.get@v1", "nope.nothing", "../x", "fixtures.unknown"]) {
      expect(await k.catchTrigger(k.triggers.create({ ...WEBHOOK_TRIGGER, capabilityId }, "admin_1")), capabilityId).toBe("TRIGGER_VALIDATION_FAILED")
    }
  })

  it("validates the fixed input against the capability schema", async () => {
    expect(await k.catchTrigger(k.triggers.create({ ...WEBHOOK_TRIGGER, input: { limit: 1000 } }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    expect(await k.catchTrigger(k.triggers.create({ ...WEBHOOK_TRIGGER, input: { unknownField: 1 } }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    expect(await k.catchTrigger(k.triggers.create({ ...WEBHOOK_TRIGGER, input: { limit: 5 } }, "admin_1"))).toBe("OK")
  })

  it("resource binding: locator must not be preset, schedules cannot bind, resource types must match", async () => {
    expect(await k.catchTrigger(k.triggers.create({ ...EVENT_TRIGGER, input: { id: "p1" } }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    expect(await k.catchTrigger(k.triggers.create({ ...SCHEDULE_TRIGGER, capabilityId: "products.get", bindResource: true }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    expect(
      await k.catchTrigger(k.triggers.create({ ...EVENT_TRIGGER, capabilityId: "subscriptions.get", event: { eventType: "PRODUCT_UPDATED" } }, "admin_1"))
    ).toBe("TRIGGER_VALIDATION_FAILED")
    expect(await k.catchTrigger(k.triggers.create({ ...WEBHOOK_TRIGGER, capabilityId: "products.list", bindResource: true }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
  })

  it("event triggers: allowlisted types only; events about a user are OWNER-scoped only", async () => {
    for (const eventType of ["PAYMENT_SUCCESS", "USER_BANNED", "REFUND_PROCESSED", "product_updated"]) {
      expect(await k.catchTrigger(k.triggers.create({ ...EVENT_TRIGGER, event: { eventType } }, "admin_1")), eventType).toBe("TRIGGER_VALIDATION_FAILED")
    }
    const sub = { ...EVENT_TRIGGER, capabilityId: "subscriptions.get", event: { eventType: "SUBSCRIPTION_ACTIVATED", actorScope: "ANY" } }
    expect(await k.catchTrigger(k.triggers.create(sub, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    expect(await k.catchTrigger(k.triggers.create({ ...sub, event: { eventType: "SUBSCRIPTION_ACTIVATED" } }, "admin_1"))).toBe("OK")
    expect(await k.catchTrigger(k.triggers.create({ ...EVENT_TRIGGER, event: { eventType: "PRODUCT_UPDATED", resourceId: "../../x" } }, "admin_1"))).toBe(
      "TRIGGER_VALIDATION_FAILED"
    )
  })

  it("schedules: one syntax, explicit timezone, bounded frequency, bounded one-time horizon", async () => {
    const withSchedule = (schedule: Record<string, unknown>) => k.catchTrigger(k.triggers.create({ ...SCHEDULE_TRIGGER, schedule }, "admin_1"))
    expect(await withSchedule({ kind: "CRON", cron: "* * * * *", timezone: "UTC" })).toBe("SCHEDULE_ERROR")
    expect(await withSchedule({ kind: "CRON", cron: "0 9 * * MON", timezone: "UTC" })).toBe("SCHEDULE_ERROR")
    expect(await withSchedule({ kind: "CRON", cron: "0 9 * * *", timezone: "Mars/Base" })).toBe("SCHEDULE_ERROR")
    expect(await withSchedule({ kind: "CRON", cron: "0 9 * * *" })).toBe("TRIGGER_VALIDATION_FAILED")
    expect(await withSchedule({ kind: "ONCE", runAt: new Date(k.state.now.getTime() - 1).toISOString() })).toBe("SCHEDULE_ERROR")
    expect(await withSchedule({ kind: "ONCE", runAt: new Date(k.state.now.getTime() + 30_000).toISOString() })).toBe("SCHEDULE_ERROR")
    expect(await withSchedule({ kind: "ONCE", runAt: new Date(k.state.now.getTime() + 400 * 86_400_000).toISOString() })).toBe("SCHEDULE_ERROR")
    expect(await withSchedule({ kind: "CRON", cron: "0 9 * * 1-5", timezone: "Asia/Kolkata", missedRunPolicy: "CATCH_UP_ONCE" })).toBe("OK")
    expect(await withSchedule({ kind: "ONCE", runAt: new Date(k.state.now.getTime() + 3_600_000).toISOString(), timezone: "UTC" })).toBe("OK")
  })

  it("refuses unusable connections and other environments", async () => {
    expect(await k.catchTrigger(k.triggers.create({ ...WEBHOOK_TRIGGER, connectionId: "conn_missing" }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    k.fake.updateConnection("conn_1", { status: "REVOKED" })
    expect(await k.catchTrigger(k.triggers.create(WEBHOOK_TRIGGER, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    k.fake.updateConnection("conn_1", { status: "ACTIVE", environment: "production" })
    expect(await k.catchTrigger(k.triggers.create(WEBHOOK_TRIGGER, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
  })

  it("rejects an expiry in the past", async () => {
    expect(await k.catchTrigger(k.triggers.create({ ...WEBHOOK_TRIGGER, expiresAt: new Date(k.state.now.getTime() - 1000).toISOString() }, "admin_1"))).toBe(
      "TRIGGER_VALIDATION_FAILED"
    )
  })
})

describe("Phase 9 C — webhook secrets", () => {
  it("is returned exactly once, stored encrypted, never in a view", async () => {
    const { trigger, webhookSecret } = await k.triggers.create(WEBHOOK_TRIGGER, "admin_1")
    expect(webhookSecret).toMatch(/^whsec_[0-9a-f]{64}$/)
    const row = k.triggerRow(trigger.triggerRef)
    expect(row.webhookSecretRef).not.toContain(webhookSecret!)
    expect(k.secrets.openWebhookSecret(row.webhookSecretRef)).toBe(webhookSecret)
    const view = await k.triggers.get(trigger.triggerRef)
    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain(webhookSecret!)
    expect(serialized).not.toContain(row.webhookSecretRef)
    expect(view.webhook).toEqual({ path: `/api/agent-webhooks/${trigger.triggerRef}`, secretVersion: 1 })
  })

  it("rotation issues a new secret once, bumps the version and replaces the old one", async () => {
    const { trigger, webhookSecret } = await k.triggers.create(WEBHOOK_TRIGGER, "admin_1")
    const rotated = await k.triggers.rotateWebhookSecret(trigger.triggerRef, trigger.version, "admin_2")
    expect(rotated.webhookSecret).not.toBe(webhookSecret)
    expect(rotated.trigger.webhook!.secretVersion).toBe(2)
    expect(rotated.trigger.version).toBe(trigger.version + 1)
    expect(k.secrets.openWebhookSecret(k.triggerRow(trigger.triggerRef).webhookSecretRef)).toBe(rotated.webhookSecret)
    expect(await k.catchTrigger(k.triggers.rotateWebhookSecret(trigger.triggerRef, trigger.version, "admin_2"))).toBe("TRIGGER_CONFLICT")
    const ev = await k.triggers.create(EVENT_TRIGGER, "admin_1")
    expect(await k.catchTrigger(k.triggers.rotateWebhookSecret(ev.trigger.triggerRef, 1, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
  })
})

describe("Phase 9 A — lifecycle and optimistic concurrency", () => {
  it("activate / pause / resume / disable / revoke follow the state machine", async () => {
    const { trigger } = await k.triggers.create(SCHEDULE_TRIGGER, "admin_1")
    const active = await k.triggers.transition(trigger.triggerRef, 1, "activate", "admin_1")
    expect(active).toMatchObject({ status: "ACTIVE", version: 2 })
    expect(active.schedule!.nextRunAt).toBe("2026-10-02T11:00:00.000Z")
    const paused = await k.triggers.transition(trigger.triggerRef, 2, "pause", "admin_1")
    expect(paused.status).toBe("PAUSED")
    expect(await k.catchTrigger(k.triggers.transition(trigger.triggerRef, 3, "activate", "admin_1"))).toBe("TRIGGER_INVALID_TRANSITION")
    // Paused for 5 hours: resume starts at the next FUTURE occurrence (nothing replayed).
    k.advance(5 * 3_600_000)
    const resumed = await k.triggers.transition(trigger.triggerRef, 3, "resume", "admin_1")
    expect(resumed.schedule!.nextRunAt).toBe("2026-10-02T16:00:00.000Z")
    const disabled = await k.triggers.transition(trigger.triggerRef, 4, "disable", "admin_1")
    expect(disabled.schedule!.nextRunAt).toBeNull()
    const revoked = await k.triggers.transition(trigger.triggerRef, 5, "revoke", "admin_1")
    expect(revoked.status).toBe("REVOKED")
    for (const action of ["activate", "resume", "pause", "disable", "revoke"] as const) {
      expect(await k.catchTrigger(k.triggers.transition(trigger.triggerRef, 6, action, "admin_1")), action).toBe("TRIGGER_INVALID_TRANSITION")
    }
  })

  it("a stale version is a CONFLICT; two admins racing on one version: exactly one wins", async () => {
    const { trigger } = await k.triggers.create(WEBHOOK_TRIGGER, "admin_1")
    await k.triggers.transition(trigger.triggerRef, 1, "activate", "admin_1")
    expect(await k.catchTrigger(k.triggers.transition(trigger.triggerRef, 1, "pause", "admin_2"))).toBe("TRIGGER_CONFLICT")
    const results = await Promise.all([
      k.catchTrigger(k.triggers.transition(trigger.triggerRef, 2, "pause", "admin_1")),
      k.catchTrigger(k.triggers.transition(trigger.triggerRef, 2, "disable", "admin_2")),
    ])
    expect(results.filter((r) => r === "OK")).toHaveLength(1)
    expect(results.filter((r) => r !== "OK")[0]).toMatch(/TRIGGER_CONFLICT|TRIGGER_INVALID_TRANSITION/)
    expect(k.triggerRow(trigger.triggerRef).version).toBe(3)
  })

  it("configuration is editable only while the trigger cannot fire", async () => {
    const { trigger } = await k.triggers.create(SCHEDULE_TRIGGER, "admin_1")
    const edited = await k.triggers.update(trigger.triggerRef, 1, { name: "Renamed", schedule: { kind: "CRON", cron: "0 9 * * *", timezone: "Asia/Kolkata" } }, "admin_2")
    expect(edited).toMatchObject({ name: "Renamed", version: 2, schedule: { cron: "0 9 * * *", timezone: "Asia/Kolkata", nextRunAt: null } })
    await k.triggers.transition(trigger.triggerRef, 2, "activate", "admin_1")
    expect(await k.catchTrigger(k.triggers.update(trigger.triggerRef, 3, { name: "Again" }, "admin_1"))).toBe("TRIGGER_INVALID_TRANSITION")
    // Immutable fields are rejected by the schema, whatever the state.
    expect(await k.catchTrigger(k.triggers.update(trigger.triggerRef, 3, { capabilityId: "products.get" }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    expect(await k.catchTrigger(k.triggers.update(trigger.triggerRef, 3, { connectionId: "conn_2" }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    await k.triggers.transition(trigger.triggerRef, 3, "pause", "admin_1")
    // Settings of another trigger type are rejected.
    expect(await k.catchTrigger(k.triggers.update(trigger.triggerRef, 4, { event: { eventType: "PRODUCT_UPDATED" } }, "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    expect((await k.triggers.update(trigger.triggerRef, 4, { concurrency: "QUEUE_ONE" }, "admin_1")).version).toBe(5)
  })

  it("activation re-checks the connection and the pinned capability version", async () => {
    const { trigger } = await k.triggers.create(WEBHOOK_TRIGGER, "admin_1")
    k.fake.updateConnection("conn_1", { status: "SUSPENDED" })
    expect(await k.catchTrigger(k.triggers.transition(trigger.triggerRef, 1, "activate", "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
    k.fake.updateConnection("conn_1", { status: "ACTIVE" })
    const v2 = { ...k.registry.get("products.list")!, version: 2 }
    k.registry.register(v2)
    expect(await k.catchTrigger(k.triggers.transition(trigger.triggerRef, 1, "activate", "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
  })

  it("an expired trigger cannot be activated", async () => {
    const { trigger } = await k.triggers.create({ ...WEBHOOK_TRIGGER, expiresAt: new Date(k.state.now.getTime() + 60_000).toISOString() }, "admin_1")
    k.advance(61_000)
    expect(await k.catchTrigger(k.triggers.transition(trigger.triggerRef, 1, "activate", "admin_1"))).toBe("TRIGGER_VALIDATION_FAILED")
  })

  it("revoking a connection revokes all its live triggers", async () => {
    const a = await k.createActive(WEBHOOK_TRIGGER)
    const b = await k.triggers.create(SCHEDULE_TRIGGER, "admin_1")
    expect(await k.triggers.revokeForConnection("conn_1", "admin_9")).toBe(2)
    expect(k.triggerRow(a.trigger.triggerRef).status).toBe("REVOKED")
    expect(k.triggerRow(b.trigger.triggerRef).status).toBe("REVOKED")
    expect(k.triggerRow(a.trigger.triggerRef).nextRunAt).toBeNull()
  })

  it("unknown or malformed refs are NOT_FOUND", async () => {
    for (const ref of ["trg_" + "0".repeat(32), "trg_x", "", "../../etc"]) expect(await k.catchTrigger(k.triggers.get(ref))).toBe("TRIGGER_NOT_FOUND")
  })
})
