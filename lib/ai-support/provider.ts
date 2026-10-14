import { env } from "@/lib/env"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

function resolveProvider() {
  // Prefer TokenRouter when configured; fall back to OPENAI_* only when no
  // router key exists (prevents a stale OPENAI_API_KEY from shadowing it).
  const trKey = process.env.TOKENROUTER_API_KEY
  const key = trKey ?? env.OPENAI_API_KEY
  const base = trKey
    ? process.env.TOKENROUTER_BASE_URL ?? "https://api.tokenrouter.com/v1"
    : (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "")
  return { key, base }
}

export async function chatCompletion(messages: ChatMessage[], opts?: { timeoutMs?: number }): Promise<string> {
  const { key, base } = resolveProvider()
  if (!key) throw new Error("OPENAI_API_KEY not configured")
  const trKey = process.env.TOKENROUTER_API_KEY
  const model = env.AI_SUPPORT_CHAT_MODEL !== "gpt-4o" ? env.AI_SUPPORT_CHAT_MODEL : trKey ? "z-ai/glm-5.3-flash" : "gpt-4o"
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 25000)
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0, top_p: 1 }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`OpenAI chat failed: ${res.status}`)
    const json = (await res.json()) as { choices: { message: { content: string } }[] }
    return json.choices[0]?.message?.content ?? ""
  } finally {
    clearTimeout(t)
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { key, base } = resolveProvider()
  if (!key) throw new Error("OPENAI_API_KEY not configured")
  const model = env.AI_SUPPORT_EMBEDDING_MODEL ?? "text-embedding-3-small"
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: texts }),
  })
  if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status}`)
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  return json.data.map((d) => d.embedding)
}
