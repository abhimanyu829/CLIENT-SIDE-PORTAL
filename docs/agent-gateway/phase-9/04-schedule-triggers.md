# Phase 9 — Schedule Triggers

## Configuration

| Kind | Fields | Rules |
|---|---|---|
| `CRON` | `cron`, `timezone`, `missedRunPolicy` | standard 5-field numeric cron (`* , - /` only; no names, `@` macros, `?`, `L`, seconds); explicit IANA timezone; no two of the next 50 occurrences closer than `AGENT_GATEWAY_TRIGGER_MIN_INTERVAL_MS` (5 min) |
| `ONCE` | `runAt`, optional `timezone`, `missedRunPolicy` | at least 1 minute and at most `AGENT_GATEWAY_TRIGGER_MAX_ONCE_HORIZON_MS` (365 days) ahead |

Schedules cannot bind a resource (there is no incoming resource).

## Driving the schedule — reusing the existing scheduler

`lib/workers.ts` `scheduleRecurringJobs()` adds ONE repeatable job, `agent-trigger.schedule-tick` with `repeat: { pattern: "* * * * *" }` — the same mechanism as the subscription, payment and Phase 8 maintenance jobs. Each tick:

1. reads ACTIVE schedule triggers with `nextRunAt <= now` (batch 100, oldest first);
2. plans the occurrence (`planDueOccurrence`, see `08-scheduling-semantics.md`);
3. claims it with `UPDATE ... WHERE id = ? AND status = 'ACTIVE' AND nextRunAt = <seen value>` — concurrent ticks, duplicated tick jobs or two worker processes fire an occurrence exactly once;
4. fires (`deliveryKey = schedule:<ISO occurrence>`) or records `SKIPPED_MISSED`;
5. moves a finished schedule (one-time, or no occurrence before `expiresAt`) to `EXPIRED`;
6. expires triggers past `expiresAt` and promotes waiting `QUEUE_ONE` runs.

Schedule state lives only in Postgres. BullMQ never holds a per-trigger job, so pausing, editing or deleting a trigger can never leave a stale Redis schedule behind.

## Lifecycle effects

- Activation and resume set `nextRunAt` to the next **future** occurrence; time spent paused or disabled is never replayed.
- Pause keeps `nextRunAt` (the tick ignores non-ACTIVE triggers); disable and revoke clear it.
- Editing a schedule requires DRAFT / PAUSED / DISABLED and clears `nextRunAt` until re-activation.
- A schedule whose stored state cannot be evaluated (corrupted cron, unknown timezone) is disabled with a `FAILED SCHEDULE_ERROR` run; it never fires.

## Precision

Occurrences fire within one tick (≤ 60 s) plus queue latency. An occurrence handled more than `AGENT_GATEWAY_TRIGGER_LATE_TOLERANCE_MS` (2 min) late is a missed run.
