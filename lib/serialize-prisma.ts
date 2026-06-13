export function serializePrisma<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString() as T
  if (typeof value !== "object") return value

  const maybeDecimal = value as { toNumber?: () => number; constructor?: { name?: string } }
  if (maybeDecimal.constructor?.name === "Decimal" && typeof maybeDecimal.toNumber === "function") {
    return maybeDecimal.toNumber() as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializePrisma(item)) as T
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializePrisma(item)])
  ) as T
}
