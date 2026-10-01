/**
 * components/admin/agent-governance/ui.tsx
 *
 * Server-renderable presentational pieces for the Agent Governance pages
 * (no hooks, no client state). Built on the existing components/ui table
 * primitives. Accessibility: every table has a caption and column-scoped
 * headers, statuses are text (never colour alone), filters are a native GET
 * form with labelled controls, pagination is a labelled nav landmark, and
 * error states use role="alert".
 */
import Link from "next/link"
import type { ReactNode } from "react"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { PageMeta, SearchParams } from "@/lib/agent-gateway/governance/pagination"

export const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  SUCCEEDED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  TASK_CREATED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  CONSUMED: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  QUEUED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  RETRY_QUEUED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  STARTING: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  RUNNING: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  CANCELLING: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  DRAFT: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  PAUSED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  SUSPENDED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  APPROVAL_REQUIRED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  DISABLED: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  SUPERSEDED: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  DROPPED: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  SKIPPED_MISSED: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  EXPIRED: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  CANCELLED: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  REVOKED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  REJECTED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  FAILED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  DENIED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  TIMED_OUT: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  // Phase 11 — ledger outcomes and recovery states.
  SUCCESS: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  INFO: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  REQUESTED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  EXECUTING: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  MANUAL_RECOVERY_REQUIRED: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", TONES[status] ?? TONES.DRAFT)}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

/** Deterministic UTC display (no locale-dependent formatting). */
export function Time({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return <time dateTime={value}>{`${value.slice(0, 19).replace("T", " ")} UTC`}</time>
}

export function SectionHeader({ title, description, children, id, level = 2 }: { title: string; description?: string; children?: ReactNode; id?: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3"
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Heading id={id} className={level === 2 ? "text-xl font-semibold" : "font-medium"}>
          {title}
        </Heading>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  )
}

/** Storage / dependency failure — distinct from "no data". */
export function Unavailable({ what }: { what: string }) {
  return (
    <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
      {what} could not be loaded right now. Nothing was changed. Try again shortly.
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function FeatureNotice({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
      {children}
    </div>
  )
}

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

export function GovTable<T>({ caption, columns, rows, rowKey, empty }: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty: ReactNode }) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.header} scope="col" className={c.className}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((c) => (
                <TableCell key={c.header} className={c.className}>
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function hrefWith(basePath: string, params: SearchParams | undefined, key: string, value: number): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k === key || v === undefined) continue
    const first = Array.isArray(v) ? v[0] : v
    if (first) search.set(k, first)
  }
  search.set(key, String(value))
  return `${basePath}?${search.toString()}`
}

export function Pagination({ basePath, meta, params, pageParam = "page", label = "Pagination" }: { basePath: string; meta: PageMeta; params?: SearchParams; pageParam?: string; label?: string }) {
  if (meta.totalPages <= 1) return <p className="text-sm text-muted-foreground">{meta.total} total</p>
  const link = "rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
  const off = "rounded-md border px-3 py-1.5 text-sm text-muted-foreground opacity-60"
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </p>
      <div className="flex gap-2">
        {meta.hasPrev ? (
          <Link className={link} href={hrefWith(basePath, params, pageParam, meta.page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={off} aria-disabled="true">
            Previous
          </span>
        )}
        {meta.hasNext ? (
          <Link className={link} href={hrefWith(basePath, params, pageParam, meta.page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <span className={off} aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  )
}

export interface FilterField {
  name: string
  label: string
  value?: string
  options: ReadonlyArray<{ value: string; label: string }>
}

/** A native GET form: works without JavaScript, resets to page 1, server-side filtering only. */
export function FilterBar({ action, fields }: { action: string; fields: FilterField[] }) {
  return (
    <form method="get" action={action} role="search" aria-label="Filters" className="flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label htmlFor={`filter-${f.name}`} className="text-xs font-medium text-muted-foreground">
            {f.label}
          </label>
          <select id={`filter-${f.name}`} name={f.name} defaultValue={f.value ?? ""} className={selectClass}>
            <option value="">All</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button type="submit" className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-muted">
        Apply filters
      </button>
      <Link href={action} className="h-9 rounded-md px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Reset
      </Link>
    </form>
  )
}

export const enumOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v.replace(/_/g, " ") }))

export function KeyValues({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function StatCard({ label, value, href, hint }: { label: string; value: ReactNode; href?: string; hint?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  )
  return href ? (
    <Link href={href} className="block rounded-lg border p-4 hover:bg-muted/50">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border p-4">{body}</div>
  )
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs">{children}</span>
}
