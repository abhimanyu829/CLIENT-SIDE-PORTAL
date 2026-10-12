import { env } from "@/lib/env"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export async function chatCompletion(messages: ChatMessage[], opts?: { timeoutMs?: number }): Promise<string> {
  const key = env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY not configured")
  const model = env.AI_SUPPORT_CHAT_MODEL ?? "gpt-4o"
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 25000)
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.2 }),
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
  const key = env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY not configured")
  const model = env.AI_SUPPORT_EMBEDDING_MODEL ?? "text-embedding-3-small"
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: texts }),
  })
  if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status}`)
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  return json.data.map((d) => d.embedding)
}
