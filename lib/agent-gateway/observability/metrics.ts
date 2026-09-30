/**
 * lib/agent-gateway/observability/metrics.ts
 *
 * Minimal in-process counters (Phase 1 spec §29). The existing stack has
 * no Prometheus/StatsD client wired in (confirmed absent in Phase 0's
 * audit — the app uses Sentry for error tracking, not a metrics
 * exporter), so Phase 1 does not add a new monitoring platform. These
 * counters are exposed via the internal health/readiness surface only;
 * a real exporter integration is a Phase 2+ decision if/when one exists
 * in the host app.
 */

export interface GatewayMetricsSnapshot {
  gateway_requests_total: number
  gateway_auth_success_total: number
  gateway_auth_failure_total: number
  gateway_rate_limited_total: number
  gateway_replay_blocked_total: number
  gateway_signature_failure_total: number
  gateway_upstream_errors_total: number
  gateway_request_body_rejections_total: number
  // Phase 8 — async task lifecycle counters (same in-process mechanism).
  agent_task_created_total: number
  agent_task_queued_total: number
  agent_task_started_total: number
  agent_task_retrying_total: number
  agent_task_succeeded_total: number
  agent_task_failed_total: number
  agent_task_cancellation_requested_total: number
  agent_task_cancelled_total: number
  agent_task_expired_total: number
  agent_task_timed_out_total: number
  agent_task_security_violation_total: number
}

const counters: GatewayMetricsSnapshot = {
  gateway_requests_total: 0,
  gateway_auth_success_total: 0,
  gateway_auth_failure_total: 0,
  gateway_rate_limited_total: 0,
  gateway_replay_blocked_total: 0,
  gateway_signature_failure_total: 0,
  gateway_upstream_errors_total: 0,
  gateway_request_body_rejections_total: 0,
  agent_task_created_total: 0,
  agent_task_queued_total: 0,
  agent_task_started_total: 0,
  agent_task_retrying_total: 0,
  agent_task_succeeded_total: 0,
  agent_task_failed_total: 0,
  agent_task_cancellation_requested_total: 0,
  agent_task_cancelled_total: 0,
  agent_task_expired_total: 0,
  agent_task_timed_out_total: 0,
  agent_task_security_violation_total: 0,
}

export function incrementMetric(name: keyof GatewayMetricsSnapshot): void {
  counters[name] += 1
}

export function getMetricsSnapshot(): GatewayMetricsSnapshot {
  return { ...counters }
}

/** Test-only: resets all counters to zero. */
export function __resetMetricsForTests(): void {
  for (const key of Object.keys(counters) as (keyof GatewayMetricsSnapshot)[]) {
    counters[key] = 0
  }
}
