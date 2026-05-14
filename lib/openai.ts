import OpenAI from "openai"
import { env } from "@/lib/env"

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
})

/**
 * Helper with exponential backoff retry (max 3 attempts).
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      return await operation()
    } catch (error: any) {
      attempt++
      if (attempt >= maxRetries || (error.status && error.status !== 429 && error.status !== 503)) {
        throw error
      }
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.warn(`[OpenAI] Request failed, retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error("Max retries exceeded")
}

export async function streamChat(messages: any[], model = "gpt-4o") {
  return await withRetry(() => openai.chat.completions.create({
    model,
    messages,
    stream: true,
  }))
}

export async function generateEmbedding(input: string) {
  const response = await withRetry(() => openai.embeddings.create({
    model: "text-embedding-3-small",
    input,
  }))
  return response.data[0].embedding
}
