export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  if (!normalized) return []
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length)
    // Prefer heading/paragraph boundary
    if (end < normalized.length) {
      const lookback = normalized.slice(Math.max(start, end - 200), end)
      const para = lookback.lastIndexOf("\n\n")
      if (para >= 0) end = Math.max(start, end - 200) + para
    }
    chunks.push(normalized.slice(start, end).trim())
    if (end >= normalized.length) break
    start = end - overlap
  }
  return chunks.filter(Boolean)
}

export function hashContent(content: string): string {
  let h = 0
  for (let i = 0; i < content.length; i++) h = (Math.imul(31, h) + content.charCodeAt(i)) | 0
  return String(h)
}
