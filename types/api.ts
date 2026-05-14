// ── Generic API response wrappers ─────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ── Standard error codes ──────────────────────────────────────────────────────

export const API_ERROR_CODES = {
  // Auth
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  INVALID_TOKEN: "INVALID_TOKEN",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_FIELDS: "MISSING_FIELDS",
  INVALID_FORMAT: "INVALID_FORMAT",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // Payments
  PAYMENT_FAILED: "PAYMENT_FAILED",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  INVALID_COUPON: "INVALID_COUPON",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

// ── Utility types ─────────────────────────────────────────────────────────────

/** Sortable query params for list endpoints */
export interface SortParams {
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

/** Standard list/search query params */
export interface ListParams extends SortParams {
  page?: number
  limit?: number
  q?: string
}

/** Wraps any value to indicate it came from the API and may be serialized (dates as strings) */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
    ? string | null
    : T[K] extends Date | undefined
    ? string | undefined
    : T[K] extends object
    ? Serialized<T[K]>
    : T[K]
}

/** Makes specific keys optional */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/** Makes specific keys required */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>
