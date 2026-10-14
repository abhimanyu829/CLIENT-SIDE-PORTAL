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

const INJECTION_PHRASES = [
  "ignore previous instructions",
  "ignore all previous",
  "ignore the above",
  "disregard previous",
  "disregard all previous",
  "forget your instructions",
  "reveal system prompt",
  "reveal your instructions",
  "show me your system prompt",
  "print your instructions",
  "access another customer",
  "bypass authorization",
  "override your",
  "you are now",
  "developer mode",
  "jailbreak",
]

export function isPromptInjection(text: string): boolean {
  const lower = text.toLowerCase()
  return INJECTION_PHRASES.some((p) => lower.includes(p))
}

/**
 * True when text (typically retrieved knowledge content) attempts to issue
 * instructions. Retrieved content is data, never an instruction source.
 */
export function containsInjection(text: string): boolean {
  return isPromptInjection(text)
}

/**
 * Defangs instruction-like phrases inside retrieved content so that, even if a
 * chunk somehow reaches the model, it can no longer be read as a command.
 * Used as a second line of defence on top of dropping flagged chunks.
 */
export function neutralizeInjection(text: string): string {
  let out = text
  for (const p of INJECTION_PHRASES) {
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    out = out.replace(re, "[removed instruction]")
  }
  return out
}
