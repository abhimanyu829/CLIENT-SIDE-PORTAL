/**
 * lib/agent-gateway/recovery/service.ts
 *
 * Phase 11 — capability-aware, evidence-driven recovery ("rollback").
 *
 * A recovery is requested by a SUPER_ADMIN for ONE recorded execution (an
 * "execution.succeeded" ledger event). Nothing is reconstructed from
 * mutable state: the identifiers the recovery needs were captured into that
 * ledger event at execution time, and the event's digest and chain link are
 * re-verified before they are used.
 *
 *   REVERSIBLE / COMPENSATABLE / PARTIALLY_REVERSIBLE
 *     -> the declared recovery capability runs through the SAME chain as any
 *        agent operation: ExecutionGate (identity, Phase 6 authorization,
 *        Phase 7 autonomy / human approval) and the Phase 4 resolver (schema,
 *        environment, idempotency, circuit breakers, audit intent). It acts
 *        as the ORIGINAL connection, which must still be ACTIVE, same owner,
 *        same environment. A recovery is itself a privileged operation:
 *        nothing here bypasses a denial, and an approval-requiring recovery
 *        waits for a human approval like any other operation.
 *   IRREVERSIBLE (or no explicit mapping)
 *     -> nothing is faked: the recovery is recorded as
 *        MANUAL_RECOVERY_REQUIRED with the capability's recommendation.
 *
 * Idempotency: one AgentRecovery row per source event (unique), every state
 * change is a conditional update, and the recovery capability receives a
 * deterministic idempotency key, so a duplicate request can never run the
 * recovery twice.
 */
import { db } from "@/lib/db"
import type { AgentGatewayRequestContext } from "../shared/types"
import { generateRequestId } from "../shared/crypto"
import type { CapabilityRegistry } from "../capabilities/registry"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AdapterRegistry } from "../execution/resolver/adapter-registry"
import { AdapterResolver } from "../execution/resolver/adapter-resolver"
import { buildExecutionContext } from "../execution/resolver/build-execution-context"
import { toExecutionError } from "../execution/contracts/execution-error"
import type { AgentExecutionContext } from "../execution/contracts/execution-context"
import type { ExecutionResult } from "../execution/contracts/execution-result"
import type { GateGrant } from "../execution-gate/gate"
import { AuthorizationDeniedError } from "../mcp/errors"
import { GovernanceError, notFound } from "../governance/errors"
import { getGatewayConfig } from "../config"
import { eventDigestMatches, findAuditEventByEventId } from "../audit-ledger/ledger"
import { recordAudit } from "../audit-ledger/recorder"
import type { AuditAction, AuditEventRow } from "../audit-ledger/types"
import { countMetric } from "../observability/agent-metrics"
import { currentTraceContext, newTraceId, runWithTraceContext } from "../observability/trace-context"
import { withAgentSpan } from "../observability/tracing"
import { resolveRecoverySpec, type RecoveryClass, type RecoverySpec } from "./spec"
import {
  createRecovery,
  findRecoveryBySourceEvent,
  newRecoveryRef,
  transitionRecovery,
  type AgentRecoveryRow,
  type RecoveryStatus,
} from "./store"

export interface RecoveryGate {
  grant(context: AgentExecutionContext, capability: CapabilityDefinition, input: unknown): Promise<GateGrant>
}

export interface RecoveryExecutor {
  execute(capabilityRef: string, rawInput: unknown, gatewayContext: AgentGatewayRequestContext, idempotencyKey?: string): Promise<ExecutionResult>
}

export interface RecoveryConnectionState {
  status: string
  environment: string
  ownerId: string
  teamId: string | null
  externalAgentId: string | null
}

export interface RecoveryServiceDeps {
  capabilityRegistry: CapabilityRegistry
  adapterRegistry: AdapterRegistry
  gate: RecoveryGate
  executor?: RecoveryExecutor
  environment?: string
  clock?: () => Date
  loadConnection?: (connectionId: string) => Promise<RecoveryConnectionState | null>
}

export interface RecoveryView {
  recoveryRef: string
  sourceEventId: string
  connectionId: string
  capabilityId: string
  capabilityVersion: number
  recoveryClass: RecoveryClass
  recoveryCapabilityId: string | null
  status: RecoveryStatus
  attempts: number
  version: number
  reason: string | null
  recommendation: string | null
  residualEffects: string | null
  approvalRef: string | null
  errorCode: string | null
  requestedAt: Date
  completedAt: Date | null
}

export function toRecoveryView(row: AgentRecoveryRow): RecoveryView {
  return {
    recoveryRef: row.publicRef,
    sourceEventId: row.sourceEventId,
    connectionId: row.connectionId,
    capabilityId: row.capabilityId,
    capabilityVersion: row.capabilityVersion,
    recoveryClass: row.recoveryClass,
    recoveryCapabilityId: row.recoveryCapabilityId,
    status: row.status,
    attempts: row.attempts,
    version: row.version,
    reason: row.reason,
    recommendation: row.recommendation,
    residualEffects: row.residualEffects,
    approvalRef: row.approvalRef,
    errorCode: row.errorCode,
    requestedAt: row.requestedAt,
    completedAt: row.completedAt,
  }
}

const RETRYABLE: RecoveryStatus[] = ["REQUESTED", "FAILED", "APPROVAL_REQUIRED"]
const EVENT_ID = /^aud_[0-9a-f]{32}$/

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
}

async function defaultLoadConnection(connectionId: string): Promise<RecoveryConnectionState | null> {
  return (await db.agentConnection.findUnique({
    where: { id: connectionId },
    select: { status: true, environment: true, ownerId: true, teamId: true, externalAgentId: true },
  })) as RecoveryConnectionState | null
}

export class RecoveryService {
  private readonly executor: RecoveryExecutor
  private readonly clock: () => Date
  private readonly environment: string

  constructor(private readonly deps: RecoveryServiceDeps) {
    this.executor = deps.executor ?? new AdapterResolver(deps.capabilityRegistry, deps.adapterRegistry)
    this.clock = deps.clock ?? (() => new Date())
    this.environment = deps.environment ?? getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT
  }

  /** Requests (or retries) the recovery of one recorded execution. Idempotent per execution. */
  async requestRecovery(input: { eventId: string; reason?: string }, actor: { userId: string }): Promise<RecoveryView> {
    if (!EVENT_ID.test(input.eventId)) throw notFound("Recorded execution")
    const event = await findAuditEventByEventId(input.eventId)
    if (!event) throw notFound("Recorded execution")
    if (event.action !== "execution.succeeded" || !event.capabilityId || !event.capabilityVersion || !event.connectionId || !event.ownerId) {
      throw new GovernanceError("VALIDATION_FAILED", "Only a recorded, successful execution can be recovered.")
    }
    await this.assertEvidenceIntact(event)

    const definition = this.deps.capabilityRegistry.getVersion(event.capabilityId, event.capabilityVersion)
    const spec: RecoverySpec | null = definition
      ? resolveRecoverySpec(definition)
      : { class: "IRREVERSIBLE", manualRecoveryRequired: true, recommendation: "The capability version that ran is no longer registered. Review the affected resource manually." }
    if (!spec) throw new GovernanceError("VALIDATION_FAILED", "Read-only executions have nothing to recover.")

    let row = await findRecoveryBySourceEvent(event.eventId)
    if (!row) {
      const manual = spec.class === "IRREVERSIBLE" || spec.manualRecoveryRequired
      try {
        row = await createRecovery({
          publicRef: newRecoveryRef(),
          sourceEventId: event.eventId,
          connectionId: event.connectionId,
          ownerId: event.ownerId,
          capabilityId: event.capabilityId,
          capabilityVersion: event.capabilityVersion,
          recoveryClass: spec.class,
          recoveryCapabilityId: spec.capabilityId ?? null,
          recoveryCapabilityVersion: spec.capabilityVersion ?? null,
          status: manual ? "MANUAL_RECOVERY_REQUIRED" : "REQUESTED",
          reason: input.reason?.slice(0, 500) ?? null,
          recommendation: spec.recommendation,
          residualEffects: spec.residualEffects ?? null,
          requestedById: actor.userId,
          completedAt: manual ? this.clock() : null,
        })
        this.evidence(row, manual ? "recovery.manual_required" : "recovery.requested", actor.userId, { reason: input.reason })
        countMetric("agent_rollback_total", { outcome: manual ? "MANUAL" : "REQUESTED", recovery_class: spec.class })
      } catch (err) {
        if (!isUniqueViolation(err)) throw err
        row = await findRecoveryBySourceEvent(event.eventId) // a concurrent request created it
        if (!row) throw new GovernanceError("CONFLICT", "The recovery changed concurrently. Reload and try again.")
      }
    }

    if (!RETRYABLE.includes(row.status)) return toRecoveryView(row)
    return toRecoveryView(await this.execute(row, event, spec, actor.userId))
  }

  /**
   * The evidence the recovery relies on must be untampered: its own digest,
   * its link to its predecessor, and its successor's link to it (an edited
   * event whose digest was recomputed still breaks the next link). The
   * newest event has no successor yet; a rewrite of it requires bypassing
   * the database's append-only trigger and is caught by chain verification
   * against the logged external anchor.
   */
  private async assertEvidenceIntact(event: AuditEventRow): Promise<void> {
    let intact = eventDigestMatches(event)
    if (intact && event.sequence > 1) {
      const previous = (await db.agentAuditEvent.findUnique({ where: { sequence: event.sequence - 1 }, select: { eventDigest: true } })) as { eventDigest: string } | null
      intact = !!previous && previous.eventDigest === event.previousEventDigest
    }
    if (intact) {
      const next = (await db.agentAuditEvent.findUnique({ where: { sequence: event.sequence + 1 }, select: { previousEventDigest: true } })) as { previousEventDigest: string } | null
      intact = !next || next.previousEventDigest === event.eventDigest
    }
    if (!intact) {
      recordAudit({
        action: "security.input_rejected",
        outcome: "DENIED",
        actor: { type: "SYSTEM" },
        connectionId: event.connectionId,
        capabilityId: event.capabilityId,
        errorCode: "EVIDENCE_INTEGRITY",
        metadata: { reasonCode: "RECOVERY_EVIDENCE_TAMPERED" },
      })
      throw new GovernanceError("INVALID_STATE", "The recorded execution failed its integrity check. Recovery refused; verify the audit ledger.")
    }
  }

  private evidence(row: AgentRecoveryRow, action: AuditAction, actorId: string | null, extra: Record<string, string | undefined> = {}, errorCode?: string | null): void {
    recordAudit({
      action,
      outcome: action === "recovery.succeeded" ? "SUCCESS" : action === "recovery.failed" ? "FAILED" : "INFO",
      actor: actorId ? { type: "HUMAN", id: actorId } : { type: "SYSTEM" },
      connectionId: row.connectionId,
      ownerId: row.ownerId,
      capabilityId: row.recoveryCapabilityId ?? row.capabilityId,
      errorCode: errorCode ?? null,
      approvalRef: row.approvalRef,
      metadata: {
        recoveryRef: row.publicRef,
        recoveryClass: row.recoveryClass,
        recoveryCapabilityId: row.recoveryCapabilityId ?? undefined,
        residualEffects: row.residualEffects ?? undefined,
        manualRecoveryRequired: row.status === "MANUAL_RECOVERY_REQUIRED",
        ...extra,
      },
    })
  }

  private async finish(row: AgentRecoveryRow, status: RecoveryStatus, data: { errorCode?: string | null; approvalRef?: string | null; recommendation?: string }): Promise<AgentRecoveryRow> {
    const terminal = status === "SUCCEEDED" || status === "MANUAL_RECOVERY_REQUIRED"
    await transitionRecovery(row.id, { status: "EXECUTING", version: row.version }, { status, ...data, completedAt: terminal ? this.clock() : null })
    return (await findRecoveryBySourceEvent(row.sourceEventId)) ?? row
  }

  private async execute(row: AgentRecoveryRow, event: AuditEventRow, spec: RecoverySpec, actorId: string): Promise<AgentRecoveryRow> {
    // Claim: exactly one caller moves the recovery to EXECUTING.
    const claimed = await transitionRecovery(row.id, { status: RETRYABLE, version: row.version }, { status: "EXECUTING", attempts: { increment: 1 }, errorCode: null })
    const fresh = (await findRecoveryBySourceEvent(row.sourceEventId)) ?? row
    if (!claimed) return fresh
    this.evidence(fresh, "recovery.executing", actorId)

    const manual = async (reasonCode: string, recommendation?: string) => {
      const done = await this.finish(fresh, "MANUAL_RECOVERY_REQUIRED", { errorCode: reasonCode, ...(recommendation ? { recommendation } : {}) })
      this.evidence(done, "recovery.manual_required", actorId, {}, reasonCode)
      countMetric("agent_rollback_total", { outcome: "MANUAL", recovery_class: done.recoveryClass })
      return done
    }

    // 1. Identifiers recorded at execution time (never re-derived from mutable state).
    const captured = (event.metadata as { recoveryInput?: Record<string, unknown> } | null)?.recoveryInput
    const fields = Object.keys(spec.inputMapping ?? {})
    if (!captured || typeof captured !== "object" || fields.some((f) => !(f in captured))) {
      return manual("RECOVERY_INPUT_UNAVAILABLE", "The recorded execution does not carry the identifiers the recovery needs. Recover manually.")
    }
    const recoveryInput: Record<string, unknown> = {}
    for (const f of fields) recoveryInput[f] = captured[f]

    // 2. The original connection, live: still ACTIVE, same owner, same environment.
    const connection = await (this.deps.loadConnection ?? defaultLoadConnection)(fresh.connectionId).catch(() => null)
    if (!connection || connection.status !== "ACTIVE" || connection.ownerId !== fresh.ownerId || connection.environment !== this.environment || event.environment !== this.environment) {
      return manual("CONNECTION_NOT_ACTIVE", "The agent connection that performed this operation is no longer active in this environment. Recover manually through the existing admin tools.")
    }

    // 3. The explicit recovery capability, exactly the declared version, executable.
    const recovery = this.deps.capabilityRegistry.getVersion(spec.capabilityId!, spec.capabilityVersion!)
    if (!recovery || recovery.status !== "ACTIVE" || recovery.exposure !== "AGENT_AVAILABLE" || !this.deps.adapterRegistry.has(recovery.id, recovery.version)) {
      return manual("RECOVERY_CAPABILITY_UNAVAILABLE", "The declared recovery capability is not available. Recover manually.")
    }

    const gatewayContext: AgentGatewayRequestContext = {
      requestId: generateRequestId(),
      receivedAt: this.clock(),
      authenticated: true,
      machine: {
        connectionId: fresh.connectionId,
        // Not a credential: the recovery acts on the recorded, server-derived identity.
        credentialId: `agent-recovery:${fresh.publicRef}`,
        ownerId: fresh.ownerId,
        agentId: connection.externalAgentId ?? undefined,
        teamId: connection.teamId,
        connectionStatus: "ACTIVE",
        authenticatedAt: this.clock(),
      },
      connectionId: fresh.connectionId,
      ownerId: fresh.ownerId,
      agentId: connection.externalAgentId ?? undefined,
      teamId: connection.teamId ?? undefined,
      protocol: "MCP",
      signal: new AbortController().signal,
    }

    const run = () =>
      withAgentSpan("agent.recovery", { "agent.capability.id": recovery.id, "agent.connection.id": fresh.connectionId, "agent.request.id": gatewayContext.requestId }, async () => {
        // 4. The same gate as any agent operation (authorization, autonomy, approval).
        try {
          await this.deps.gate.grant(buildExecutionContext(gatewayContext, recovery.id, recovery.version, this.environment), recovery, recoveryInput)
        } catch (err) {
          if (err instanceof AuthorizationDeniedError) {
            if (err.code === "APPROVAL_REQUIRED" || err.code === "APPROVAL_BINDING_MISMATCH" || err.code === "APPROVAL_POLICY_CHANGED") {
              const approvalRef = /apr_[0-9a-f]{32}/.exec(err.message)?.[0] ?? null
              const waiting = await this.finish(fresh, "APPROVAL_REQUIRED", { approvalRef, errorCode: err.code })
              this.evidence(waiting, "recovery.approval_required", actorId, {}, err.code)
              countMetric("agent_rollback_total", { outcome: "APPROVAL_REQUIRED", recovery_class: waiting.recoveryClass })
              return waiting
            }
            const denied = await this.finish(fresh, "FAILED", { errorCode: err.code })
            this.evidence(denied, "recovery.failed", actorId, {}, err.code)
            countMetric("agent_rollback_total", { outcome: "DENIED", recovery_class: denied.recoveryClass })
            return denied
          }
          const failed = await this.finish(fresh, "FAILED", { errorCode: "POLICY_UNAVAILABLE" })
          this.evidence(failed, "recovery.failed", actorId, {}, "POLICY_UNAVAILABLE")
          countMetric("agent_rollback_total", { outcome: "FAILURE", recovery_class: failed.recoveryClass })
          return failed
        }
        // 5. The Phase 4 resolver: schema, environment, idempotency, breakers, audit intent.
        try {
          const key = recovery.idempotency.requiresIdempotencyKey ? `recovery.${fresh.publicRef}` : undefined
          await this.executor.execute(`${recovery.id}@v${recovery.version}`, recoveryInput, gatewayContext, key)
        } catch (err) {
          const code = toExecutionError(err).code
          const failed = await this.finish(fresh, "FAILED", { errorCode: code })
          this.evidence(failed, "recovery.failed", actorId, {}, code)
          countMetric("agent_rollback_total", { outcome: "FAILURE", recovery_class: failed.recoveryClass })
          return failed
        }
        const done = await this.finish(fresh, "SUCCEEDED", { errorCode: null })
        this.evidence(done, "recovery.succeeded", actorId)
        countMetric("agent_rollback_total", { outcome: "SUCCESS", recovery_class: done.recoveryClass })
        return done
      })

    return currentTraceContext() ? run() : runWithTraceContext({ traceId: newTraceId(), requestId: gatewayContext.requestId }, run)
  }
}
