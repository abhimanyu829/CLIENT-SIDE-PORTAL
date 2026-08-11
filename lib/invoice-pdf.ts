// Minimal, dependency-free PDF builder for invoice downloads.
// Produces a valid single-page PDF (PDF 1.4) from invoice data. Used as the
// on-demand fallback when no R2 object is stored (pdfUrl null) so existing
// invoices remain downloadable without regenerating or altering records.
// When R2 is configured and pdfUrl is set, the download route prefers the R2
// presigned-URL path (see app/api/invoices/[id]/download/route.ts).

export type InvoicePdfInput = {
  number: string
  userName?: string | null
  userEmail?: string | null
  status?: string | null
  issuedAt?: Date | string | null
  totalAmount?: string | number | null
  taxAmount?: string | number | null
  currency?: string | null
  lineItems?: Array<{ name?: string | null; quantity?: number | null; unitPrice?: string | number | null }> | null
  transactionRef?: string | null
}

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function fmtMoney(v: unknown, currency?: string | null): string {
  const n = Number(v ?? 0)
  return `${Number.isFinite(n) ? n.toFixed(2) : "0.00"}${currency ? ` ${currency}` : ""}`
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—"
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function buildInvoicePdf(input: InvoicePdfInput): Buffer {
  const lines: string[] = [
    "NexusAI Invoice",
    `Invoice #: ${input.number}`,
    `Status: ${input.status ?? "—"}`,
    `Issued: ${fmtDate(input.issuedAt)}`,
    `Customer: ${input.userName ?? "—"}${input.userEmail ? ` <${input.userEmail}>` : ""}`,
    "",
    "Line items:",
  ]
  const items = input.lineItems ?? []
  if (items.length === 0) lines.push("  NexusAI item")
  for (const item of items) {
    const qty = item.quantity ?? 1
    const unit = item.unitPrice ?? ""
    lines.push(`  ${item.name ?? "NexusAI item"}  x${qty}  ${fmtMoney(unit)}`)
  }
  lines.push("", `Tax: ${fmtMoney(input.taxAmount, input.currency)}`, `Total: ${fmtMoney(input.totalAmount, input.currency)}`)
  if (input.transactionRef) lines.push("", `Transaction: ${input.transactionRef}`)

  // Build the page content stream. /F1 11 Tf, 14 TL leading, T* between lines.
  const contentLines = lines.map((l) => escapePdfText(l))
  const streamBody = "BT\n/F1 11 Tf\n14 TL\n50 800 Td\n(" + contentLines.join(") Tj\nT* (") + ") Tj\nET\n"
  const streamBytes = Buffer.from(streamBody, "utf-8")

  const objects: string[] = []
  objects.push("<< /Type /Catalog /Pages 2 0 R >>")
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>")
  objects.push(`<< /Length ${streamBytes.length} >>\nstream\n${streamBody}endstream`)
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xrefStart = Buffer.byteLength(pdf, "utf-8")
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return Buffer.from(pdf, "utf-8")
}
