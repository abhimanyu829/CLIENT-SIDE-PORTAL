/**
 * lib/agent-gateway/security/evidence.ts
 *
 * Phase 12 — security findings as ledger evidence and metrics. Field paths,
 * signal codes and counts only: never the content that triggered them.
 *
 * Every finding here can be provoked by whoever controls some content or
 * input (a vendor naming a product, an agent sending input), so each is
 * throttled per (connection, capability, kind) with the suppressed count
 * carried on the next event (Phase 11 recordAuditThrottled).
 */
import { recordAuditThrottled } from "../audit-ledger/recorder"
import type { AuditEventInput } from "../audit-ledger/types"
import { countMetric } from "../observability/agent-metrics"
import type { ContentFindings } from "./content-guard"

type EvidenceBase = Omit<AuditEventInput, "action" | "outcome" | "metadata">

const WINDOW_MS = 60_000

function keyOf(kind: string, base: Partial<EvidenceBase>): string {
  return `${kind}:${base.connectionId ?? "-"}:${base.capabilityId ?? "-"}`
}

export function recordContentFindings(base: EvidenceBase, findings: ContentFindings): void {
  try {
    if (findings.redactions.count > 0) {
      countMetric("agent_content_findings_total", { kind: "SECRET_REDACTED", capability: base.capabilityId })
      recordAuditThrottled(
        {
          ...base,
          action: "security.secret_redacted",
          outcome: "INFO",
          metadata: { fields: findings.redactions.fields, redactedCount: findings.redactions.count, classification: findings.redactions.kinds.join(",") },
        },
        keyOf("secret", base),
        WINDOW_MS
      )
    }
    if (findings.injection.signals.length > 0) {
      countMetric("agent_content_findings_total", { kind: "INJECTION_SUSPECTED", capability: base.capabilityId })
      recordAuditThrottled(
        {
          ...base,
          action: "security.injection_suspected",
          outcome: "INFO",
          metadata: { signals: findings.injection.signals, fields: findings.injection.fields, classification: findings.trust },
        },
        keyOf("injection", base),
        WINDOW_MS
      )
    }
  } catch {
    // Evidence never changes the result.
  }
}

/** Counted here; the reason itself is recorded on the execution.failed event (detailCode) by the resolver. */
export function recordOutputWithheld(base: Partial<EvidenceBase>): void {
  try {
    countMetric("agent_content_findings_total", { kind: "OUTPUT_WITHHELD", capability: base.capabilityId })
  } catch {
    // never affects the refusal
  }
}

export function recordInputRejected(
  base: { connectionId?: string | null; ownerId?: string | null; capabilityId?: string | null; requestId?: string | null },
  reason: string,
  path: string,
  origin: "MCP" | "EXECUTION" | "TASK"
): void {
  try {
    countMetric("agent_content_findings_total", { kind: "INPUT_REJECTED", capability: base.capabilityId })
    countMetric("agent_security_denial_total", { reason })
    recordAuditThrottled(
      {
        action: "security.input_rejected",
        outcome: "DENIED",
        actor: base.connectionId ? { type: "AGENT", id: base.connectionId } : { type: "SYSTEM" },
        connectionId: base.connectionId ?? null,
        ownerId: base.ownerId ?? null,
        capabilityId: base.capabilityId ?? null,
        requestId: base.requestId ?? null,
        errorCode: "INVALID_INPUT",
        metadata: { reasonCode: reason, fields: [path], origin },
      },
      `input:${base.connectionId ?? "-"}:${base.capabilityId ?? "-"}:${reason}`,
      WINDOW_MS
    )
  } catch {
    // never affects the refusal
  }
}

export function recordOutboundBlocked(base: { connectionId?: string | null; capabilityId?: string | null }, reason: string, host: string | null): void {
  try {
    countMetric("agent_content_findings_total", { kind: "OUTBOUND_BLOCKED", capability: base.capabilityId })
    recordAuditThrottled(
      {
        action: "security.outbound_blocked",
        outcome: "DENIED",
        actor: { type: "SYSTEM" },
        connectionId: base.connectionId ?? null,
        capabilityId: base.capabilityId ?? null,
        errorCode: "OUTBOUND_BLOCKED",
        metadata: { reasonCode: reason, target: host ?? undefined },
      },
      `outbound:${base.connectionId ?? "-"}:${reason}`,
      WINDOW_MS
    )
  } catch {
    // never affects the refusal
  }
}
