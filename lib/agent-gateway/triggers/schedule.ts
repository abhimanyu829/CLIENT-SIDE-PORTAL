/**
 * lib/agent-gateway/triggers/schedule.ts
 *
 * Schedule semantics. One syntax only: standard 5-field cron
 * (minute hour day-of-month month day-of-week), numeric fields with
 * `*`, `,`, `-`, `/`. Parsed by `cron-parser` — the same library BullMQ
 * uses for its repeatable jobs — always with an explicit IANA timezone
 * (never the server's). One-time schedules use an absolute instant.
 *
 * Missed runs (worker / Redis / server down) are decided explicitly:
 *   SKIP           missed occurrences never run; the schedule resumes at the
 *                  next future occurrence ("queue the next valid run").
 *   CATCH_UP_ONCE  however many were missed, exactly ONE run fires now for
 *                  the newest missed occurrence (if within the catch-up
 *                  window), then the schedule resumes.
 * Hours or days of backlog are therefore never replayed.
 */
import { parseExpression } from "cron-parser"
import type { MissedRunPolicy } from "./types"

const FIELD_PATTERN = /^[0-9*,/-]+$/

export function isValidTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== "string" || timezone.length === 0 || timezone.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0)
    return true
  } catch {
    return false
  }
}

/** Throws a descriptive Error when `expression` is not a supported 5-field cron. */
export function assertCronExpression(expression: unknown): asserts expression is string {
  if (typeof expression !== "string" || expression.length > 100) throw new Error("The schedule must be a cron expression of at most 100 characters.")
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error("The schedule must be a standard 5-field cron expression (minute hour day month weekday).")
  if (!fields.every((f) => FIELD_PATTERN.test(f))) throw new Error("Cron fields may contain only digits, '*', ',', '-' and '/'.")
  try {
    parseExpression(fields.join(" "), { tz: "UTC" }).next()
  } catch {
    throw new Error("The cron expression is not valid.")
  }
}

/** The first occurrence strictly after `after`, in `timezone`. */
export function nextOccurrence(expression: string, timezone: string, after: Date): Date | null {
  try {
    const it = parseExpression(expression, { tz: timezone, currentDate: after })
    return it.next().toDate()
  } catch {
    return null
  }
}

/** The newest occurrence at or before `atOrBefore`. */
export function previousOccurrence(expression: string, timezone: string, atOrBefore: Date): Date | null {
  try {
    const it = parseExpression(expression, { tz: timezone, currentDate: new Date(atOrBefore.getTime() + 1) })
    return it.prev().toDate()
  } catch {
    return null
  }
}

export function nextOccurrences(expression: string, timezone: string, after: Date, count: number): Date[] {
  const out: Date[] = []
  const it = parseExpression(expression, { tz: timezone, currentDate: after })
  for (let i = 0; i < count; i += 1) out.push(it.next().toDate())
  return out
}

/** Bounded frequency: no two of the next occurrences may be closer than `minIntervalMs`. */
export function assertBoundedFrequency(expression: string, timezone: string, from: Date, minIntervalMs: number): void {
  const upcoming = nextOccurrences(expression, timezone, from, 50)
  for (let i = 1; i < upcoming.length; i += 1) {
    if (upcoming[i].getTime() - upcoming[i - 1].getTime() < minIntervalMs) {
      throw new Error(`The schedule fires more often than once every ${Math.round(minIntervalMs / 60_000)} minutes.`)
    }
  }
}

export interface ScheduleState {
  scheduleKind: string | null
  cronExpression: string | null
  timezone: string | null
  runAt: Date | null
  missedRunPolicy: MissedRunPolicy | null
  nextRunAt: Date | null
  expiresAt: Date | null
}

export interface OccurrencePlan {
  /** Fire a run for `scheduledFor`. When false the occurrence is recorded as SKIPPED_MISSED. */
  fire: boolean
  scheduledFor: Date
  /** True when the occurrence (or several) was missed. */
  missed: boolean
  /** New nextRunAt; null when the schedule is finished (one-time, or past expiresAt). */
  nextRunAt: Date | null
}

export interface PlanOptions {
  lateToleranceMs: number
  catchUpWindowMs: number
}

/**
 * Decides what to do with a due schedule at `now` (requires nextRunAt <= now).
 * Pure and deterministic — tested at exact boundaries, across timezones and
 * DST transitions.
 */
export function planDueOccurrence(state: ScheduleState, now: Date, opts: PlanOptions): OccurrencePlan {
  if (!state.nextRunAt) throw new Error("The schedule has no pending occurrence.")
  // Stored state is re-validated, never trusted: a corrupted schedule is an
  // error (the caller disables the trigger), not a silent fire-and-finish.
  if (state.scheduleKind === "CRON") {
    assertCronExpression(state.cronExpression)
    if (!isValidTimezone(state.timezone)) throw new Error("Unknown timezone.")
  } else if (state.scheduleKind !== "ONCE") {
    throw new Error("Unknown schedule kind.")
  }
  const due = new Date(state.nextRunAt)
  const t = now.getTime()
  const finish = (next: Date | null): Date | null => (next && state.expiresAt && next.getTime() > new Date(state.expiresAt).getTime() ? null : next)

  if (state.scheduleKind === "ONCE") {
    const late = t - due.getTime() > opts.lateToleranceMs
    const fire = !late || (state.missedRunPolicy === "CATCH_UP_ONCE" && t - due.getTime() <= opts.catchUpWindowMs)
    return { fire, scheduledFor: due, missed: late, nextRunAt: null }
  }

  const cron = state.cronExpression!
  const tz = state.timezone!
  const newest = previousOccurrence(cron, tz, now) ?? due
  const onlyThisOne = newest.getTime() <= due.getTime()
  const late = t - due.getTime() > opts.lateToleranceMs

  if (onlyThisOne && !late) {
    return { fire: true, scheduledFor: due, missed: false, nextRunAt: finish(nextOccurrence(cron, tz, due)) }
  }

  // Missed: at least one occurrence could not run on time.
  const resumeAt = finish(nextOccurrence(cron, tz, now))
  const scheduledFor = onlyThisOne ? due : newest
  const withinWindow = t - scheduledFor.getTime() <= opts.catchUpWindowMs
  const fire = state.missedRunPolicy === "CATCH_UP_ONCE" && withinWindow
  return { fire, scheduledFor, missed: true, nextRunAt: resumeAt }
}

/** First nextRunAt when a schedule is activated / resumed at `now`. */
export function initialNextRunAt(state: Pick<ScheduleState, "scheduleKind" | "cronExpression" | "timezone" | "runAt" | "expiresAt">, now: Date): Date | null {
  if (state.scheduleKind === "ONCE") {
    return state.runAt && new Date(state.runAt).getTime() > now.getTime() ? new Date(state.runAt) : null
  }
  const next = nextOccurrence(state.cronExpression!, state.timezone!, now)
  if (!next) return null
  if (state.expiresAt && next.getTime() > new Date(state.expiresAt).getTime()) return null
  return next
}
