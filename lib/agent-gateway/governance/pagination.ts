/**
 * lib/agent-gateway/governance/pagination.ts
 *
 * Server-side pagination with the admin panel's existing convention:
 * `?page=N`, a fixed page size of 20, offset paging (`skip` / `take`), and a
 * total count. Every list query is bounded by `take`, whatever is requested.
 */
export const PAGE_SIZE = 20
export const MAX_PAGE = 10_000

export type SearchParams = Record<string, string | string[] | undefined>

export function firstParam(params: SearchParams | undefined, key: string): string | undefined {
  const value = params?.[key]
  if (Array.isArray(value)) return value[0]
  return value
}

export function parsePage(value: unknown): number {
  const n = typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : 1
  return Math.min(Math.max(n, 1), MAX_PAGE)
}

export const skipFor = (page: number) => (page - 1) * PAGE_SIZE

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
}

export function pageMeta(total: number, page: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return { page, pageSize: PAGE_SIZE, total, totalPages, hasPrev: page > 1, hasNext: page < totalPages }
}

export interface Paged<T> {
  rows: T[]
  meta: PageMeta
}

/** Only allowlisted enum values are ever used as filters; anything else is ignored. */
export function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

/** Plain identifiers only (ids, refs, capability ids). */
export function pickId(value: unknown, pattern: RegExp = /^[A-Za-z0-9_.@:-]{1,80}$/): string | undefined {
  return typeof value === "string" && pattern.test(value) ? value : undefined
}
