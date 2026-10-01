# Phase 10 — Schedule Management

Schedules are triggers of type `SCHEDULE` (Phase 9). Their state lives in Postgres (`nextRunAt`, `lastScheduledFor`); one repeatable tick fires due occurrences. Governance manages them through the trigger routes and shows them on `/schedules`.

## The schedules page

| Column | Source |
|---|---|
| When | cron expression, or the one-time instant |
| Timezone | the schedule's IANA timezone |
| Missed runs | `SKIP` or `CATCH_UP_ONCE` |
| Next runs | `nextRunAt` (authoritative) followed by the next two occurrences computed with the same parser in the schedule's timezone (display only) |
| Last scheduled | `lastScheduledFor` |

Example (tested): `0 9 * * 1-5` in `Asia/Kolkata` lists three weekday occurrences at 03:30 UTC.

## Editing

A schedule can be edited only while it cannot fire (pause or disable first). Editing clears `nextRunAt`; resuming or activating sets it to the next **future** occurrence, so nothing from the paused period is replayed. Bounded frequency (≥ 5 minutes), timezone validity and the one-time horizon are re-validated by the Phase 9 service.

## Operations visibility

The runtime page counts ACTIVE schedules whose `nextRunAt` is more than two late tolerances in the past ("overdue schedules"): a sign the tick or the worker is not running.
