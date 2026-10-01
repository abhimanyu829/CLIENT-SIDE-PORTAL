# Phase 9 — Scheduling Semantics

## Timezones

Every cron schedule is evaluated in its own IANA timezone with cron-parser (the library BullMQ uses for repeatable jobs), never in the server's timezone.

| Case | Behaviour (tested) |
|---|---|
| `0 9 * * *` UTC | 09:00Z daily |
| `0 9 * * *` Asia/Kolkata (UTC+05:30, no DST) | 03:30Z daily |
| `0 9 * * *` America/New_York across 2027-03-14 (spring forward) | 14:00Z, then 13:00Z: always 09:00 local |
| `0 9 * * *` America/New_York across 2026-11-01 (fall back) | 13:00Z, then 14:00Z: always 09:00 local |
| `30 2 * * *` New York on 2027-03-14 (02:30 does not exist) | fires **once**, at 03:30 EDT |
| `30 1 * * *` New York on 2026-11-01 (01:30 happens twice) | fires **once** (the first 01:30) |

## Missed runs

A missed occurrence is one handled more than 2 minutes late (worker, Redis or server down). The missed-run policy decides:

| Policy | Behaviour |
|---|---|
| `SKIP` (default) | no missed occurrence runs; the schedule resumes at the next future occurrence ("queue the next valid run"). Recorded as `SKIPPED_MISSED` |
| `CATCH_UP_ONCE` | however many were missed, exactly ONE run fires now for the newest missed occurrence, if it is within the 24 h catch-up window; then the schedule resumes |

A backlog of hours or days is never replayed. The prompt's `QUEUE_NEXT_VALID_RUN` is the `SKIP` behaviour: in a cron model the "next valid run" is simply the next future occurrence, so it is not a separate mode.

## Exact boundaries (tested)

| Situation | Result |
|---|---|
| `now == occurrence` | fire |
| `now == occurrence + 2 min` | fire (on time) |
| `now == occurrence + 2 min + 1 ms` | missed |
| one-time, `CATCH_UP_ONCE`, exactly 24 h late | fire |
| one-time, `CATCH_UP_ONCE`, 24 h + 1 ms late | not fired |
| next occurrence after `expiresAt` | schedule finishes (EXPIRED) after this occurrence |

## Bounded frequency

No two of the next 50 occurrences may be closer than 5 minutes (configurable, minimum 1 minute). `* * * * *`, `*/4 * * * *` and `0,1 9 * * *` are rejected; `*/5 * * * *` is accepted.

## Pause / resume

Resume recomputes `nextRunAt` from the resume time. A schedule paused from 11:00 to 16:00 resumes at the next occurrence after 16:00; nothing from the paused window runs, regardless of the missed-run policy (a pause is a human decision, not an outage).
