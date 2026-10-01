/**
 * lib/agent-gateway/security/injection-detector.ts
 *
 * Phase 12 — prompt-injection SIGNALS in data the platform hands to agents.
 *
 * Tool results carry text written by third parties (vendors name products,
 * customers write ticket subjects). An attacker can plant instructions in
 * that text, hoping the agent's model will follow them. This detector looks
 * for the recognisable shapes of such payloads.
 *
 * It is ADVISORY, by design:
 *   - it never blocks or rewrites content (a false positive must not break
 *     a legitimate product or ticket);
 *   - nothing in the platform's security depends on it: what an agent may
 *     do is decided only by server-side identity, Phase 6 policy, Phase 7
 *     autonomy and human approval, which no text in a tool result can
 *     change (see docs/agent-gateway/phase-12/03-prompt-injection.md);
 *   - its findings label the result for the agent ("this is data, not
 *     instructions") and become evidence (security.injection_suspected,
 *     field paths and signal codes only — never the content).
 *
 * Obfuscation handled: Unicode compatibility forms (NFKC: full-width,
 * ligatures), invisible characters splitting words, and "ASCII smuggling"
 * through Unicode tag characters (decoded and scanned as well).
 * Bounded: depth, number of strings and scanned characters are capped; the
 * patterns use only bounded quantifiers.
 */

export type InjectionSignal =
  | "INSTRUCTION_OVERRIDE"
  | "ROLE_REASSIGNMENT"
  | "CHAT_TEMPLATE_MARKUP"
  | "TOOL_INVOCATION"
  | "DATA_EXFILTRATION"
  | "CREDENTIAL_REQUEST"
  | "HIDDEN_CHARACTERS"

export const INJECTION_SIGNALS: readonly InjectionSignal[] = [
  "INSTRUCTION_OVERRIDE",
  "ROLE_REASSIGNMENT",
  "CHAT_TEMPLATE_MARKUP",
  "TOOL_INVOCATION",
  "DATA_EXFILTRATION",
  "CREDENTIAL_REQUEST",
  "HIDDEN_CHARACTERS",
]

const RULES: ReadonlyArray<{ signal: InjectionSignal; pattern: RegExp }> = [
  {
    signal: "INSTRUCTION_OVERRIDE",
    pattern:
      /\b(?:ignore|disregard|forget|override|bypass)\b[\s\S]{0,40}?\b(?:previous|prior|above|earlier|preceding|all|any|your|the|these|those|system|developer)\b[\s\S]{0,40}?\b(?:instructions?|prompts?|rules|guidelines|directives|guardrails|polic(?:y|ies))\b/i,
  },
  { signal: "INSTRUCTION_OVERRIDE", pattern: /\b(?:new|updated|revised|real|actual|hidden|secret|additional)\s+(?:system\s+)?instructions?\s*[:\-–—]/i },
  {
    signal: "ROLE_REASSIGNMENT",
    pattern: /\byou\s+are\s+now\s+(?:an?\s+|the\s+|in\s+)?(?:admin|administrator|developer|system|root|superuser|unrestricted|jailbroken|dan|evil|god)\b/i,
  },
  { signal: "ROLE_REASSIGNMENT", pattern: /\b(?:act|behave|pretend|roleplay)\s+as\s+(?:an?\s+|the\s+)?(?:admin|administrator|developer|system|root|superuser|unrestricted)\b/i },
  { signal: "ROLE_REASSIGNMENT", pattern: /\b(?:developer|god|jailbreak|dan|sudo)\s+mode\b/i },
  { signal: "CHAT_TEMPLATE_MARKUP", pattern: /<\|(?:im_start|im_end|system|user|assistant|endoftext|eot_id|start_header_id|end_header_id)\|>|\[\/?INST\]|<<\/?SYS>>/i },
  { signal: "CHAT_TEMPLATE_MARKUP", pattern: /<\/?(?:system|assistant|tool_call|function_call|tool_use|instructions)>|^\s*#{2,}\s*(?:system|assistant|instructions?)\b/im },
  {
    signal: "TOOL_INVOCATION",
    pattern: /\b(?:tool_call|function_call|tools\/call|tool_use|agent_task_(?:submit|status|cancel))\b|"(?:tool|tool_name|function|name)"\s*:\s*"[^"]{1,80}"\s*,\s*"(?:arguments|args|parameters|input)"\s*:/i,
  },
  { signal: "DATA_EXFILTRATION", pattern: /!\[[^\]]{0,100}\]\(\s*(?:https?:)?\/\/[^)\s]+/i },
  {
    signal: "DATA_EXFILTRATION",
    pattern:
      /\b(?:send|post|upload|exfiltrate|forward|transmit|leak)\s+(?:(?:all|the|your|this|my|every|our)\s+){0,2}(?:data|conversation|chat|history|context|secrets?|tokens?|api\s*keys?|credentials?|passwords?|everything|system\s+prompt)\b[\s\S]{0,40}?\b(?:to|at|into)\b/i,
  },
  {
    signal: "CREDENTIAL_REQUEST",
    pattern:
      /\b(?:reveal|print|show|display|output|repeat|leak|dump)\s+(?:me\s+)?(?:your|the\s+system|the\s+hidden|all\s+(?:your\s+)?)\s*(?:system\s+prompt|instructions|api[\s_-]?keys?|tokens?|secrets?|credentials?|private\s+keys?|environment\s+variables)\b/i,
  },
]

/** Invisible characters an attacker uses to split words (ZWJ / ZWNJ are excluded: they are legitimate in emoji and Indic / Persian text). */
const INVISIBLE = /[\u200B\u2060-\u2064\uFEFF\u00AD\u180E]/g
const INVISIBLE_ONE = /[\u200B\u2060-\u2064\uFEFF\u00AD\u180E]/
const BIDI = /[\u202A-\u202E\u2066-\u2069]/
const TAG = /[\u{E0000}-\u{E007F}]/u
const TAGS_GLOBAL = /[\u{E0000}-\u{E007F}]/gu

const MAX_DEPTH = 10
const MAX_STRINGS = 2_000
const MAX_CHARS_PER_STRING = 4_096
const MAX_TOTAL_CHARS = 100_000
const MAX_FIELDS = 10

export interface InjectionFindings {
  signals: InjectionSignal[]
  /** Normalised paths of the fields that triggered (array indices collapsed: "items[].name"). */
  fields: string[]
  /** True when scanning stopped early at a bound (the unscanned remainder is not evaluated). */
  truncated: boolean
}

/** Text as a model would read it: compatibility forms folded, invisible characters removed. */
export function normalizeForDetection(text: string): string {
  return text.normalize("NFKC").replace(INVISIBLE, "").replace(TAGS_GLOBAL, "")
}

/** Text hidden in Unicode tag characters (U+E0020–U+E007E map to ASCII). */
export function decodeTagSmuggling(text: string): string {
  let out = ""
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp >= 0xe0020 && cp <= 0xe007e) out += String.fromCharCode(cp - 0xe0000)
  }
  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export interface DetectorOptions {
  /** Registered tool names: any mention of one inside third-party content is a TOOL_INVOCATION signal. */
  toolNames?: readonly string[]
}

function compileToolNames(toolNames: readonly string[] | undefined): RegExp | null {
  const names = (toolNames ?? []).filter((n) => /^[A-Za-z0-9_.]{1,80}$/.test(n)).slice(0, 500)
  if (names.length === 0) return null
  return new RegExp(`(?:^|[^A-Za-z0-9_.])(?:${names.map(escapeRegExp).join("|")})(?![A-Za-z0-9_])`, "i")
}

function signalsIn(text: string, toolNames: RegExp | null): InjectionSignal[] {
  const found = new Set<InjectionSignal>()
  const raw = text.length > MAX_CHARS_PER_STRING ? text.slice(0, MAX_CHARS_PER_STRING) : text
  if (BIDI.test(raw) || TAG.test(raw) || INVISIBLE_ONE.test(raw)) found.add("HIDDEN_CHARACTERS")
  const candidates = [normalizeForDetection(raw)]
  const smuggled = decodeTagSmuggling(raw)
  if (smuggled) candidates.push(smuggled)
  for (const candidate of candidates) {
    for (const { signal, pattern } of RULES) if (!found.has(signal) && pattern.test(candidate)) found.add(signal)
    if (toolNames && !found.has("TOOL_INVOCATION") && toolNames.test(candidate)) found.add("TOOL_INVOCATION")
  }
  return INJECTION_SIGNALS.filter((s) => found.has(s))
}

/** Signals in one string. */
export function detectInText(text: string, options: DetectorOptions = {}): InjectionSignal[] {
  return signalsIn(text, compileToolNames(options.toolNames))
}

/**
 * Walks a tool result and reports which signals appear where. Never throws:
 * an internal failure yields no findings (the detector is advisory).
 */
export function detectInjection(value: unknown, options: DetectorOptions = {}): InjectionFindings {
  const signals = new Set<InjectionSignal>()
  const fields = new Set<string>()
  let strings = 0
  let chars = 0
  let truncated = false
  try {
    const toolNames = compileToolNames(options.toolNames)
    const visit = (node: unknown, path: string, depth: number): void => {
      if (truncated) return
      if (typeof node === "string") {
        strings += 1
        chars += Math.min(node.length, MAX_CHARS_PER_STRING)
        if (strings > MAX_STRINGS || chars > MAX_TOTAL_CHARS) {
          truncated = true
          return
        }
        const hit = signalsIn(node, toolNames)
        if (hit.length > 0) {
          for (const s of hit) signals.add(s)
          if (fields.size < MAX_FIELDS) fields.add(path || "$")
        }
        return
      }
      if (node === null || typeof node !== "object") return
      if (depth >= MAX_DEPTH) {
        truncated = true
        return
      }
      if (Array.isArray(node)) {
        for (const item of node) visit(item, `${path}[]`, depth + 1)
        return
      }
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) visit(child, path ? `${path}.${key}` : key, depth + 1)
    }
    visit(value, "", 0)
  } catch {
    return { signals: [], fields: [], truncated: true }
  }
  return { signals: INJECTION_SIGNALS.filter((s) => signals.has(s)), fields: Array.from(fields), truncated }
}
