const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9\-_\.]+/gi,
  /password\s*[:=]\s*\S+/gi,
]

export function redactSecrets(text: string): string {
  let out = text
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[REDACTED]")
  return out
}

export function sanitizeOutput(text: string): string {
  // Strip HTML tags — render as text only
  return text.replace(/<[^>]*>/g, "").slice(0, 8000)
}

export function isPromptInjection(text: string): boolean {
  const lower = text.toLowerCase()
  return [
    "ignore previous instructions",
    "reveal system prompt",
    "access another customer",
    "bypass authorization",
  ].some((p) => lower.includes(p))
}
