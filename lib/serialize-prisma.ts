type DecimalLike = {
  toNumber?: () => number
  toString?: () => string
  constructor?: { name?: string }
  s?: unknown
  e?: unknown
  d?: unknown
}

function isDecimalLike(value: object): value is DecimalLike {
  const candidate = value as DecimalLike

  // Prisma's Decimal constructor can be minified by the Next.js bundler, so
  // checking only constructor.name is not reliable in production.
  return (
    (candidate.constructor?.name === "Decimal" && typeof candidate.toNumber === "function") ||
    ("s" in candidate && "e" in candidate && "d" in candidate && typeof candidate.toString === "function")
  )
}

/** Converts Prisma results into React Server Component-safe plain values. */
export function serializePrisma<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString() as T
  if (typeof value === "bigint") return value.toString() as T
  if (typeof value !== "object") return value

  if (isDecimalLike(value)) {
    return (typeof value.toNumber === "function" ? value.toNumber() : Number(String(value))) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializePrisma(item)) as T
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializePrisma(item)])
  ) as T
}
