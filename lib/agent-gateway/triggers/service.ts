/**
 * lib/agent-gateway/triggers/service.ts
 *
 * HUMAN-side trigger management (the Phase 10 governance routes call this;
 * nothing agent-reachable does). Every security-relevant field is derived on
 * the server:
 *   - owner, team and environment are copied from the AgentConnection row;
 *   - the capability version is pinned at creation;
 *   - the input is validated against the capability's Phase 3 schema;
 *   - event types come from the allowlisted catalog only;
 *   - schedules are one cron syntax with an explicit timezone and a bounded
 *     frequency;
 *   - webhook secrets are generated here, stored encrypted, shown once.
 * A trigger existing grants nothing: every firing is re-authorized.
 */
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getCapabilityRegistry } from "../capabilities"
import type { CapabilityRegistry } from "../capabilities/registry"
import type { CapabilityDefinition } from "../capabilities/types"
import { assertValidCapabilityId } from "../capabilities/id"
import { canonicalJson } from "../approvals/canonical-json"
import { getGatewayConfig } from "../config"
import { getTriggerConfig, type TriggerConfig } from "./config"
import { TriggerError } from "./errors"
import { RESOURCE_ID_PATTERN, TRIGGER_EVENT_CATALOG } from "./event-catalog"
import { assertBoundedFrequency, assertCronExpression, initialNextRunAt, isValidTimezone } from "./schedule"
import { generateWebhookSecret, sealWebhookSecret } from "./secrets"
import { EDITABLE_TRIGGER_STATUSES, TRIGGER_ACTIONS } from "./state-machine"
import {
  createTriggerRow,
  findTriggerById,
  generateTriggerRef,
  listRunsForTrigger,
  updateTriggerVersioned,
} from "./store"
import { toTriggerRunView, toTriggerView } from "./view"
import type { AgentTriggerRow, TriggerAction, TriggerRunView, TriggerStatus, TriggerView } from "./types"

const resourceId = z.string().regex(RESOURCE_ID_PATTERN)
const baseFields = {
  name: z.string().trim().min(2).max(120),
  connectionId: z.string().min(1).max(64),
  capabilityId: z.string().min(1).max(80),
  input: z.record(z.unknown()).optional(),
  bindResource: z.boolean().optional(),
  concurrency: z.enum(["ALLOW_PARALLEL", "DROP_WHILE_RUNNING", "QUEUE_ONE"]).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
}
const eventConfig = z.object({ eventType: z.string().min(1).max(64), resourceId: resourceId.optional(), actorScope: z.enum(["OWNER", "ANY"]).optional() }).strict()
const cronConfig = z.object({ kind: z.literal("CRON"), cron: z.string().min(9).max(100), timezone: z.string().min(1).max(64), missedRunPolicy: z.enum(["SKIP", "CATCH_UP_ONCE"]).optional() }).strict()
const onceConfig = z.object({ kind: z.literal("ONCE"), runAt: z.coerce.date(), timezone: z.string().min(1).max(64).optional(), missedRunPolicy: z.enum(["SKIP", "CATCH_UP_ONCE"]).optional() }).strict()

export const createTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("EVENT"), ...baseFields, event: eventConfig }).strict(),
  z.object({ type: z.literal("WEBHOOK"), ...baseFields }).strict(),
  z.object({ type: z.literal("SCHEDULE"), ...baseFields, schedule: z.discriminatedUnion("kind", [cronConfig, onceConfig]) }).strict(),
])
export type CreateTriggerInput = z.infer<typeof createTriggerSchema>

/** Editable fields only. Type, connection and capability are immutable (create a new trigger instead). */
export const updateTriggerSchema = z
  .object({
    name: baseFields.name.optional(),
    input: baseFields.input,
    bindResource: baseFields.bindResource,
    concurrency: baseFields.concurrency,
    expiresAt: baseFields.expiresAt,
    event: eventConfig.partial().strict().optional(),
    schedule: z.union([cronConfig, onceConfig]).optional(),
  })
  .strict()
export type UpdateTriggerInput = z.infer<typeof updateTriggerSchema>

export interface TriggerServiceDeps {
  capabilityRegistry?: CapabilityRegistry
  config?: TriggerConfig
  clock?: () => Date
  environment?: string
}

const invalid = (message: string) => new TriggerError("TRIGGER_VALIDATION_FAILED", message)

function describeZod(err: z.ZodError): string {
  const first = err.issues[0]
  return first ? `Invalid trigger configuration (${first.path.join(".") || "input"}: ${first.message}).` : "Invalid trigger configuration."
}

export class TriggerService {
  private readonly registry: CapabilityRegistry
  private readonly config: TriggerConfig
  private readonly clock: () => Date
  private readonly environment: string

  constructor(deps: TriggerServiceDeps = {}) {
    this.registry = deps.capabilityRegistry ?? getCapabilityRegistry()
    this.config = deps.config ?? getTriggerConfig()
    this.clock = deps.clock ?? (() => new Date())
    this.environment = deps.environment ?? getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT
  }

  /** Creates a DRAFT trigger. For webhooks, the signing secret is returned exactly once. */
  async create(raw: unknown, actorId: string): Promise<{ trigger: TriggerView; webhookSecret?: string }> {
    const parsed = createTriggerSchema.safeParse(raw)
    if (!parsed.success) throw invalid(describeZod(parsed.error))
    const input = parsed.data
    const now = this.clock()

    const connection = await db.agentConnection.findUnique({
      where: { id: input.connectionId },
      select: { id: true, status: true, ownerId: true, teamId: true, environment: true },
    })
    if (!connection) throw invalid("The agent connection does not exist.")
    if (connection.status === "REVOKED" || connection.status === "EXPIRED") throw invalid("The agent connection is no longer usable.")
    if (connection.environment !== this.environment) throw invalid("The agent connection belongs to a different environment.")

    const capability = this.requireAsyncCapability(input.capabilityId)
    const bindResource = input.bindResource ?? false
    const eventType = input.type === "EVENT" ? input.event.eventType : null
    const storedInput = this.validateInput(capability, input.input ?? {}, bindResource, input.type, eventType)
    const expiresAt = input.expiresAt ?? null
    if (expiresAt && expiresAt.getTime() <= now.getTime()) throw invalid("The expiry must be in the future.")

    const data: Prisma.AgentTriggerUncheckedCreateInput = {
      publicRef: generateTriggerRef(),
      name: input.name,
      type: input.type,
      status: "DRAFT",
      version: 1,
      connectionId: connection.id,
      ownerId: connection.ownerId,
      teamId: connection.teamId ?? null,
      environment: connection.environment,
      capabilityId: capability.id,
      capabilityVersion: capability.version,
      input: storedInput,
      bindResource,
      concurrency: input.concurrency ?? "DROP_WHILE_RUNNING",
      expiresAt,
      createdById: actorId,
    }

    let webhookSecret: string | undefined
    if (input.type === "EVENT") Object.assign(data, this.eventFields(input.event, capability, bindResource))
    if (input.type === "SCHEDULE") Object.assign(data, this.scheduleFields(input.schedule, now))
    if (input.type === "WEBHOOK") {
      webhookSecret = generateWebhookSecret()
      data.webhookSecretRef = sealWebhookSecret(webhookSecret)
      data.webhookSecretVersion = 1
    }

    const row = await createTriggerRow(data)
    return { trigger: toTriggerView(row), ...(webhookSecret ? { webhookSecret } : {}) }
  }

  /** Edits a trigger that cannot currently fire (DRAFT / PAUSED / DISABLED). Optimistic on `expectedVersion`. */
  async update(triggerRef: string, expectedVersion: number, raw: unknown, actorId: string): Promise<TriggerView> {
    const parsed = updateTriggerSchema.safeParse(raw)
    if (!parsed.success) throw invalid(describeZod(parsed.error))
    const patch = parsed.data
    const current = await this.requireByRef(triggerRef)
    if (!EDITABLE_TRIGGER_STATUSES.includes(current.status as TriggerStatus)) {
      throw new TriggerError("TRIGGER_INVALID_TRANSITION", "Pause or disable the trigger before editing it.")
    }
    if (patch.event && current.type !== "EVENT") throw invalid("Event settings apply to event triggers only.")
    if (patch.schedule && current.type !== "SCHEDULE") throw invalid("Schedule settings apply to schedule triggers only.")

    const capability = this.registry.getVersion(current.capabilityId, current.capabilityVersion)
    if (!capability || !capability.async.asyncSupported) throw invalid("The trigger's capability is no longer available. Create a new trigger.")
    const now = this.clock()
    const bindResource = patch.bindResource ?? current.bindResource
    const data: Prisma.AgentTriggerUncheckedUpdateManyInput = { updatedById: actorId }
    if (patch.name !== undefined) data.name = patch.name
    if (patch.concurrency !== undefined) data.concurrency = patch.concurrency
    if (patch.expiresAt !== undefined) {
      if (patch.expiresAt && patch.expiresAt.getTime() <= now.getTime()) throw invalid("The expiry must be in the future.")
      data.expiresAt = patch.expiresAt
    }
    if (patch.input !== undefined || patch.bindResource !== undefined) {
      data.input = this.validateInput(capability, (patch.input ?? current.input ?? {}) as Record<string, unknown>, bindResource, current.type, current.eventType)
      data.bindResource = bindResource
    }
    if (patch.event) {
      Object.assign(
        data,
        this.eventFields(
          {
            eventType: patch.event.eventType ?? current.eventType!,
            resourceId: patch.event.resourceId ?? current.eventResourceId ?? undefined,
            actorScope: (patch.event.actorScope ?? current.eventActorScope ?? "OWNER") as "OWNER" | "ANY",
          },
          capability,
          bindResource
        )
      )
    }
    if (patch.schedule) Object.assign(data, this.scheduleFields(patch.schedule, now), { nextRunAt: null })

    const ok = await updateTriggerVersioned(current.id, expectedVersion, EDITABLE_TRIGGER_STATUSES, data)
    if (!ok) throw await this.conflictFor(current.id, expectedVersion)
    return toTriggerView((await findTriggerById(current.id))!)
  }

  /** activate / resume / pause / disable / revoke — optimistic on `expectedVersion`. */
  async transition(triggerRef: string, expectedVersion: number, action: TriggerAction, actorId: string): Promise<TriggerView> {
    const rule = TRIGGER_ACTIONS[action]
    if (!rule) throw invalid("Unknown trigger action.")
    const current = await this.requireByRef(triggerRef)
    if (!rule.from.includes(current.status as TriggerStatus)) {
      throw new TriggerError("TRIGGER_INVALID_TRANSITION", `A ${current.status} trigger cannot be ${action}d.`)
    }
    const now = this.clock()
    const data: Prisma.AgentTriggerUncheckedUpdateManyInput = { status: rule.to, updatedById: actorId }

    if (rule.to === "ACTIVE") {
      await this.assertActivatable(current, now)
      data.activatedAt = now
      data.pausedAt = null
      if (current.type === "SCHEDULE") {
        // Activation / resume always starts from the next FUTURE occurrence:
        // time spent paused is never replayed.
        const next = initialNextRunAt(
          { scheduleKind: current.scheduleKind, cronExpression: current.cronExpression, timezone: current.timezone, runAt: current.runAt, expiresAt: current.expiresAt },
          now
        )
        if (!next) throw new TriggerError("SCHEDULE_ERROR", "The schedule has no future occurrence.")
        data.nextRunAt = next
      }
    }
    if (rule.to === "PAUSED") data.pausedAt = now
    if (rule.to === "DISABLED") {
      data.disabledAt = now
      data.nextRunAt = null
    }
    if (rule.to === "REVOKED") {
      data.revokedAt = now
      data.nextRunAt = null
    }

    const ok = await updateTriggerVersioned(current.id, expectedVersion, rule.from, data)
    if (!ok) throw await this.conflictFor(current.id, expectedVersion)
    return toTriggerView((await findTriggerById(current.id))!)
  }

  /** Issues a new webhook secret (returned once); the previous one stops working immediately. */
  async rotateWebhookSecret(triggerRef: string, expectedVersion: number, actorId: string): Promise<{ trigger: TriggerView; webhookSecret: string }> {
    const current = await this.requireByRef(triggerRef)
    if (current.type !== "WEBHOOK") throw invalid("Only webhook triggers have a signing secret.")
    const allowed: readonly TriggerStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "DISABLED"]
    if (!allowed.includes(current.status as TriggerStatus)) throw new TriggerError("TRIGGER_INVALID_TRANSITION", "This trigger can no longer be changed.")
    const secret = generateWebhookSecret()
    const ok = await updateTriggerVersioned(current.id, expectedVersion, allowed, {
      webhookSecretRef: sealWebhookSecret(secret),
      webhookSecretVersion: (current.webhookSecretVersion ?? 0) + 1,
      updatedById: actorId,
    })
    if (!ok) throw await this.conflictFor(current.id, expectedVersion)
    return { trigger: toTriggerView((await findTriggerById(current.id))!), webhookSecret: secret }
  }

  /** Revokes every live trigger of a connection (called when the connection is revoked). */
  async revokeForConnection(connectionId: string, actorId: string): Promise<number> {
    const now = this.clock()
    const result = await db.agentTrigger.updateMany({
      where: { connectionId, status: { in: ["DRAFT", "ACTIVE", "PAUSED", "DISABLED"] } },
      data: { status: "REVOKED", revokedAt: now, nextRunAt: null, updatedById: actorId, version: { increment: 1 } },
    })
    return result.count
  }

  async get(triggerRef: string): Promise<TriggerView> {
    return toTriggerView(await this.requireByRef(triggerRef))
  }

  async listRuns(triggerRef: string, take = 25, before?: Date): Promise<TriggerRunView[]> {
    const trigger = await this.requireByRef(triggerRef)
    return (await listRunsForTrigger(trigger.id, Math.min(Math.max(take, 1), 100), before)).map(toTriggerRunView)
  }

  // ── Validation ──────────────────────────────────────────────────────────

  private requireAsyncCapability(capabilityId: string): CapabilityDefinition {
    try {
      assertValidCapabilityId(capabilityId)
    } catch {
      throw invalid("Unknown capability.")
    }
    const capability = this.registry.get(capabilityId)
    if (!capability || capability.exposure !== "AGENT_AVAILABLE" || capability.status !== "ACTIVE") throw invalid("Unknown capability.")
    if (!capability.async.asyncSupported || !capability.executionReference) throw invalid(`Capability "${capability.id}" cannot run asynchronously, so it cannot be triggered.`)
    return capability
  }

  /**
   * Validates the fixed input against the capability schema. With
   * bindResource, the resource locator field is filled at fire time from the
   * event / webhook and must not be preset.
   */
  private validateInput(
    capability: CapabilityDefinition,
    input: Record<string, unknown>,
    bindResource: boolean,
    type: string,
    eventType: string | null
  ): Prisma.InputJsonValue {
    let probe: Record<string, unknown> = input
    if (bindResource) {
      if (type === "SCHEDULE") throw invalid("Schedules have no incoming resource to bind.")
      const locator = capability.resource.resourceLocator
      if (!locator) throw invalid(`Capability "${capability.id}" has no resource locator to bind.`)
      if (locator in input) throw invalid(`"${locator}" is bound at fire time and must not be set in the input.`)
      if (eventType) {
        const def = TRIGGER_EVENT_CATALOG[eventType]
        if (!def || def.resourceType !== capability.resource.resourceType) throw invalid("The event's resource type does not match the capability's resource type.")
      }
      probe = { ...input, [locator]: "bound-resource-id" }
    }
    try {
      this.registry.validateInput(`${capability.id}@v${capability.version}`, probe)
      return JSON.parse(canonicalJson(input)) as Prisma.InputJsonValue
    } catch {
      throw invalid(`The input does not match capability "${capability.id}".`)
    }
  }

  private eventFields(event: { eventType: string; resourceId?: string; actorScope?: "OWNER" | "ANY" }, capability: CapabilityDefinition, bindResource: boolean) {
    const def = TRIGGER_EVENT_CATALOG[event.eventType]
    if (!def) throw invalid("This event type cannot drive triggers.")
    const actorScope = event.actorScope ?? "OWNER"
    if (actorScope === "ANY" && def.subjectUserField) throw invalid("Events about a user can only drive OWNER-scoped triggers.")
    if (bindResource && def.resourceType !== capability.resource.resourceType) throw invalid("The event's resource type does not match the capability's resource type.")
    return { eventType: event.eventType, eventResourceId: event.resourceId ?? null, eventActorScope: actorScope }
  }

  private scheduleFields(schedule: z.infer<typeof cronConfig> | z.infer<typeof onceConfig>, now: Date) {
    const timezone = schedule.timezone ?? "UTC"
    if (!isValidTimezone(timezone)) throw new TriggerError("SCHEDULE_ERROR", "Unknown timezone.")
    const missedRunPolicy = schedule.missedRunPolicy ?? "SKIP"
    if (schedule.kind === "CRON") {
      try {
        assertCronExpression(schedule.cron)
        assertBoundedFrequency(schedule.cron.trim().split(/\s+/).join(" "), timezone, now, this.config.minIntervalMs)
      } catch (err) {
        throw new TriggerError("SCHEDULE_ERROR", err instanceof Error ? err.message : "Invalid schedule.")
      }
      return { scheduleKind: "CRON", cronExpression: schedule.cron.trim().split(/\s+/).join(" "), timezone, runAt: null, missedRunPolicy }
    }
    const delta = schedule.runAt.getTime() - now.getTime()
    if (delta < 60_000) throw new TriggerError("SCHEDULE_ERROR", "A one-time schedule must be at least one minute in the future.")
    if (delta > this.config.maxOnceHorizonMs) throw new TriggerError("SCHEDULE_ERROR", "A one-time schedule is too far in the future.")
    return { scheduleKind: "ONCE", cronExpression: null, timezone, runAt: schedule.runAt, missedRunPolicy }
  }

  private async assertActivatable(trigger: AgentTriggerRow, now: Date): Promise<void> {
    if (trigger.expiresAt && new Date(trigger.expiresAt).getTime() <= now.getTime()) throw invalid("The trigger has expired.")
    const connection = await db.agentConnection.findUnique({ where: { id: trigger.connectionId }, select: { status: true, environment: true } })
    if (!connection || connection.status !== "ACTIVE") throw invalid("The agent connection is not active.")
    if (connection.environment !== trigger.environment || trigger.environment !== this.environment) throw invalid("The trigger belongs to a different environment.")
    // The pinned version must still be the CURRENT, exposed, async-capable
    // version: a trigger never silently runs an old or a newer version.
    let current: CapabilityDefinition | null = null
    try {
      current = this.registry.get(trigger.capabilityId)
    } catch {
      current = null
    }
    if (
      !current ||
      current.version !== trigger.capabilityVersion ||
      current.status !== "ACTIVE" ||
      current.exposure !== "AGENT_AVAILABLE" ||
      !current.async.asyncSupported
    ) {
      throw invalid("The trigger's capability version is no longer available. Create a new trigger.")
    }
  }

  private async requireByRef(triggerRef: string): Promise<AgentTriggerRow> {
    if (typeof triggerRef !== "string" || !/^trg_[0-9a-f]{32}$/.test(triggerRef)) throw new TriggerError("TRIGGER_NOT_FOUND", "Trigger not found.")
    const row = await db.agentTrigger.findUnique({ where: { publicRef: triggerRef } })
    if (!row) throw new TriggerError("TRIGGER_NOT_FOUND", "Trigger not found.")
    return row as AgentTriggerRow
  }

  private async conflictFor(id: string, expectedVersion: number): Promise<TriggerError> {
    const fresh = await findTriggerById(id)
    if (!fresh) return new TriggerError("TRIGGER_NOT_FOUND", "Trigger not found.")
    if (fresh.version !== expectedVersion) return new TriggerError("TRIGGER_CONFLICT", "The trigger was changed by someone else. Reload and try again.")
    return new TriggerError("TRIGGER_INVALID_TRANSITION", `A ${fresh.status} trigger cannot be changed this way.`)
  }
}
