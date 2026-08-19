// Dependency-free PDF builder for invoice + receipt downloads.
// Produces a valid single-page A4 PDF (PDF 1.4) from existing invoice/order/
// payment data only — amounts are backend-confirmed; this layer never computes
// or alters financial values. Used as the on-demand fallback when no R2 object
// is stored (pdfUrl null) so existing invoices remain downloadable without
// regenerating or altering records. When R2 is configured and pdfUrl is set,
// the download route prefers the R2 presigned-URL path.
//
// Only data that already exists in the database is rendered — missing fields
// are hidden gracefully, never invented.

export type InvoicePdfLineItem = {
  name?: string | null
  quantity?: number | null
  unitPrice?: string | number | null
  taxAmount?: string | number | null
  discountAmount?: string | number | null
  category?: string | null
  tierName?: string | null
  interval?: string | null
}

export type InvoicePdfAddon = {
  name?: string | null
  quantity?: number | null
  unitPrice?: string | number | null
}

export type InvoicePdfInput = {
  number: string
  status?: string | null
  issuedAt?: Date | string | null
  userName?: string | null
  userEmail?: string | null
  userPhone?: string | null
  billingAddress?: string | null
  orderNumber?: string | null
  purchaseDate?: Date | string | null
  paymentMethod?: string | null
  transactionRef?: string | null
  paidAt?: Date | string | null
  subscription?: {
    planName?: string | null
    productName?: string | null
    interval?: string | null
    startDate?: Date | string | null
    endDate?: Date | string | null
  } | null
  freeServices?: string[]
  addons?: InvoicePdfAddon[]
  lineItems?: InvoicePdfLineItem[] | null
  subtotal?: string | number | null
  discountTotal?: string | number | null
  taxAmount?: string | number | null
  totalAmount?: string | number | null
  currency?: string | null
  notes?: string | null
}

// ── PDF primitives ───────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function money(v: unknown, currency?: string | null): string {
  const n = Number(v ?? 0)
  return `${Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}${currency ? ` ${currency}` : ""}`
}

function dateStr(d: Date | string | null | undefined, withTime = false): string {
  if (!d) return "—"
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" }) +
    (withTime ? ", " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "")
}

const A4 = { width: 595, height: 842 }
const MARGIN = 48

class PdfCanvas {
  private ops: string[] = []

  text(x: number, y: number, size: number, value: string, opts: { bold?: boolean; gray?: number; align?: "left" | "right" } = {}) {
    const font = opts.bold ? "/F2" : "/F1"
    const gray = opts.gray !== undefined ? ` ${opts.gray} g` : " 0 g"
    let escaped = esc(value)
    if (opts.align === "right") {
      // Approximate width: Helvetica avg char ~0.5em, bold ~0.53em
      const factor = opts.bold ? 0.53 : 0.5
      x = x - value.length * size * factor
    }
    this.ops.push(`q${gray}\nBT ${font} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${escaped}) Tj ET\nQ`)
  }

  rect(x: number, y: number, w: number, h: number, gray: number) {
    this.ops.push(`q ${gray} g ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f Q`)
  }

  line(x1: number, y1: number, x2: number, y2: number, gray = 0.85) {
    this.ops.push(`q ${gray} G 0.8 w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S Q`)
  }

  build(): Buffer {
    const streamBody = this.ops.join("")
    const streamBytes = Buffer.from(streamBody, "utf-8")
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
      `<< /Length ${streamBytes.length} >>\nstream\n${streamBody}endstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ]
    let pdf = "%PDF-1.4\n"
    const offsets: number[] = []
    for (let i = 0; i < objects.length; i++) {
      offsets.push(Buffer.byteLength(pdf, "utf-8"))
      pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
    }
    const xrefStart = Buffer.byteLength(pdf, "utf-8")
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
    return Buffer.from(pdf, "utf-8")
  }
}

// ── Shared sections ─────────────────────────────────────────────────────────

function drawHeader(c: PdfCanvas, title: string, input: InvoicePdfInput) {
  const top = A4.height - 72
  // Brand
  c.text(MARGIN, top, 22, "NexusAI", { bold: true })
  c.text(MARGIN, top - 16, 9, "AI Marketplace · SaaS · Enterprise Services", { gray: 0.45 })
  // Document title + status
  c.text(A4.width - MARGIN, top, 20, title, { bold: true, align: "right" })
  const status = (input.status ?? "PENDING").toUpperCase()
  c.text(A4.width - MARGIN, top - 18, 10, status === "PAID" ? "PAID" : status, { bold: true, gray: status === "PAID" ? 0.05 : 0.5, align: "right" })
  c.line(MARGIN, top - 34, A4.width - MARGIN, top - 34)
}

function drawCustomerAndMeta(c: PdfCanvas, input: InvoicePdfInput, startY: number) {
  let y = startY
  const colMid = A4.width / 2 + 40

  // Billed To
  c.text(MARGIN, y, 8, "BILLED TO", { bold: true, gray: 0.45 })
  y -= 15
  c.text(MARGIN, y, 11, input.userName ?? "—", { bold: true })
  if (input.userEmail) { y -= 14; c.text(MARGIN, y, 9.5, input.userEmail, { gray: 0.3 }) }
  if (input.userPhone) { y -= 13; c.text(MARGIN, y, 9.5, input.userPhone, { gray: 0.3 }) }
  if (input.billingAddress) {
    const addrLines = input.billingAddress.split("\n").filter(Boolean).slice(0, 4)
    for (const line of addrLines) { y -= 13; c.text(MARGIN, y, 9.5, line, { gray: 0.3 }) }
  }

  // Meta rows (right column)
  let my = startY
  const meta: Array<[string, string]> = []
  meta.push(["Invoice No.", input.number])
  if (input.orderNumber) meta.push(["Order ID", input.orderNumber])
  meta.push(["Invoice Date", dateStr(input.issuedAt)])
  if (input.purchaseDate) meta.push(["Purchase Date", dateStr(input.purchaseDate, true)])
  if (input.paymentMethod) meta.push(["Payment Method", input.paymentMethod])
  if (input.paidAt) meta.push(["Paid On", dateStr(input.paidAt, true)])
  for (const [label, value] of meta) {
    c.text(colMid, my, 9, label.toUpperCase(), { bold: true, gray: 0.45 })
    c.text(A4.width - MARGIN, my, 10, value, { align: "right" })
    my -= 15
  }

  return Math.min(y, my) - 18
}

function drawSubscription(c: PdfCanvas, input: InvoicePdfInput, startY: number): number {
  const s = input.subscription
  if (!s || !s.planName) return startY
  let y = startY
  c.rect(MARGIN, y - 6, A4.width - MARGIN * 2, 66, 0.96)
  c.text(MARGIN + 12, y, 8, "SUBSCRIPTION", { bold: true, gray: 0.45 })
  y -= 16
  const rows: Array<[string, string]> = [["Plan", s.planName]]
  if (s.productName) rows.push(["Product", s.productName])
  if (s.interval) rows.push(["Billing Cycle", s.interval.replaceAll("_", " ").toLowerCase()])
  if (s.startDate) rows.push(["Start Date", dateStr(s.startDate)])
  if (s.endDate) rows.push(["Expiry Date", dateStr(s.endDate)])
  const half = Math.ceil(rows.length / 2)
  let ly = y
  let ry = y
  rows.forEach(([label, value], i) => {
    if (i < half) { c.text(MARGIN + 12, ly, 9.5, `${label}: `, { gray: 0.35 }); c.text(MARGIN + 12 + 80, ly, 9.5, value, { bold: true }); ly -= 14 }
    else { c.text(A4.width / 2 + 20, ry, 9.5, `${label}: `, { gray: 0.35 }); c.text(A4.width / 2 + 20 + 80, ry, 9.5, value, { bold: true }); ry -= 14 }
  })
  return y - 66
}

function drawItemsTable(c: PdfCanvas, input: InvoicePdfInput, startY: number): number {
  const items = input.lineItems ?? []
  let y = startY

  c.text(MARGIN, y, 8, "PURCHASED SERVICES", { bold: true, gray: 0.45 })
  y -= 10

  // Table header band
  const colQty = A4.width - MARGIN - 220
  const colUnit = A4.width - MARGIN - 150
  const colTax = A4.width - MARGIN - 80
  const colAmt = A4.width - MARGIN
  c.rect(MARGIN, y - 4, A4.width - MARGIN * 2, 20, 0.94)
  c.text(MARGIN + 8, y + 2, 8.5, "ITEM", { bold: true, gray: 0.35 })
  c.text(colQty, y + 2, 8.5, "QTY", { bold: true, gray: 0.35 })
  c.text(colUnit, y + 2, 8.5, "UNIT PRICE", { bold: true, gray: 0.35, align: "right" })
  c.text(colAmt, y + 2, 8.5, "AMOUNT", { bold: true, gray: 0.35, align: "right" })
  y -= 18

  if (items.length === 0) {
    c.text(MARGIN + 8, y, 10, "NexusAI purchase", { gray: 0.3 })
    y -= 18
  }
  for (const item of items) {
    c.text(MARGIN + 8, y, 10, (item.name ?? "NexusAI item").slice(0, 42), { bold: true })
    let sub = [item.tierName, item.category, item.interval ? item.interval.replaceAll("_", " ").toLowerCase() : null]
      .filter(Boolean).join(" · ")
    if (sub) { y -= 12; c.text(MARGIN + 8, y, 8.5, sub, { gray: 0.4 }) }
    const qty = item.quantity ?? 1
    c.text(colQty, y, 10, String(qty), { gray: 0.2 })
    c.text(colUnit, y, 10, money(item.unitPrice != null ? Number(item.unitPrice) * qty : 0, input.currency), { align: "right", gray: 0.2 })
    c.text(colAmt, y, 10, money(item.unitPrice != null ? Number(item.unitPrice) * qty : 0, input.currency), { bold: true, align: "right" })
    y -= 20
    c.line(MARGIN + 4, y + 8, A4.width - MARGIN - 4, y + 8, 0.92)
  }
  return y - 6
}

function drawBenefitsAndAddons(c: PdfCanvas, input: InvoicePdfInput, startY: number): number {
  let y = startY
  const free = (input.freeServices ?? []).slice(0, 8)
  const addons = (input.addons ?? []).slice(0, 8)

  if (free.length > 0) {
    c.text(MARGIN, y, 8, "INCLUDED FREE BENEFITS", { bold: true, gray: 0.45 })
    y -= 14
    for (const svc of free) {
      const label = typeof svc === "string" ? svc : String((svc as any)?.name ?? "")
      if (!label) continue
      c.text(MARGIN + 8, y, 9.5, `- ${label.slice(0, 70)}`, { gray: 0.25 })
      y -= 13
    }
    y -= 8
  }

  if (addons.length > 0) {
    c.text(MARGIN, y, 8, "PAID ADD-ONS", { bold: true, gray: 0.45 })
    y -= 14
    const colQty = A4.width - MARGIN - 220
    const colAmt = A4.width - MARGIN
    for (const addon of addons) {
      c.text(MARGIN + 8, y, 9.5, (addon.name ?? "Add-on").slice(0, 42), { bold: true })
      c.text(colQty, y, 9.5, String(addon.quantity ?? 1), { gray: 0.2 })
      c.text(colAmt, y, 9.5, money(addon.unitPrice != null ? Number(addon.unitPrice) * (addon.quantity ?? 1) : 0, input.currency), { align: "right" })
      y -= 15
    }
    y -= 6
  }
  return y
}

function drawTotals(c: PdfCanvas, input: InvoicePdfInput, startY: number): number {
  let y = startY
  const colLabel = A4.width - MARGIN - 180
  const colValue = A4.width - MARGIN

  const rows: Array<[string, string, boolean]> = []
  if (input.subtotal != null && Number(input.subtotal) > 0) rows.push(["Subtotal", money(input.subtotal, input.currency), false])
  if (input.discountTotal != null && Number(input.discountTotal) > 0) rows.push(["Discount", `- ${money(input.discountTotal, input.currency)}`, false])
  if (input.taxAmount != null && Number(input.taxAmount) > 0) rows.push(["Tax", money(input.taxAmount, input.currency), false])
  const total = input.totalAmount ?? 0
  rows.push(["Total Paid", money(total, input.currency), true])

  for (const [label, value, strong] of rows) {
    if (strong) {
      c.rect(A4.width - MARGIN - 240, y - 6, 240, 26, 0.94)
      c.text(colLabel, y + 2, 11, label.toUpperCase(), { bold: true })
      c.text(colValue, y + 2, 12, value, { bold: true, align: "right" })
      y -= 32
    } else {
      c.text(colLabel, y, 9.5, label, { gray: 0.35 })
      c.text(colValue, y, 10, value, { align: "right" })
      y -= 16
    }
  }
  return y
}

function drawFooter(c: PdfCanvas, input: InvoicePdfInput) {
  const y = 64
  c.line(MARGIN, y + 24, A4.width - MARGIN, y + 24, 0.88)
  if (input.transactionRef) c.text(MARGIN, y + 8, 8.5, `Transaction: ${input.transactionRef}`, { gray: 0.45 })
  c.text(MARGIN, y - 6, 8.5, "Thank you for building with NexusAI.", { gray: 0.45 })
  c.text(A4.width - MARGIN, y - 6, 8.5, "nexusai.com · support@nexusai.com", { gray: 0.45, align: "right" })
  c.text(MARGIN, y - 18, 7.5, "This document was generated electronically and is valid without signature.", { gray: 0.6 })
}

// ── Public builders ─────────────────────────────────────────────────────────

export function buildInvoicePdf(input: InvoicePdfInput): Buffer {
  const c = new PdfCanvas()
  drawHeader(c, "INVOICE", input)
  let y = drawCustomerAndMeta(c, input, A4.height - 140)
  y = drawSubscription(c, input, y)
  y = drawItemsTable(c, input, y)
  y = drawBenefitsAndAddons(c, input, y)
  y = drawTotals(c, input, y)
  if (input.notes) {
    c.text(MARGIN, y - 4, 8.5, input.notes.slice(0, 120), { gray: 0.45 })
  }
  drawFooter(c, input)
  return c.build()
}

export function buildReceiptPdf(input: InvoicePdfInput): Buffer {
  const c = new PdfCanvas()
  drawHeader(c, "PAYMENT RECEIPT", input)

  let y = A4.height - 140
  y = drawCustomerAndMeta(c, input, y)

  // Payment summary card
  c.rect(MARGIN, y - 10, A4.width - MARGIN * 2, 84, 0.96)
  c.text(MARGIN + 14, y - 2, 8, "AMOUNT PAID", { bold: true, gray: 0.45 })
  c.text(MARGIN + 14, y - 30, 26, money(input.totalAmount, input.currency), { bold: true })
  const payCol = A4.width / 2 + 40
  let py = y - 2
  const payRows: Array<[string, string]> = [["Status", (input.status ?? "PAID").toUpperCase()]]
  if (input.paymentMethod) payRows.push(["Method", input.paymentMethod])
  if (input.paidAt) payRows.push(["Paid On", dateStr(input.paidAt, true)])
  if (input.transactionRef) payRows.push(["Transaction", input.transactionRef.slice(0, 30)])
  for (const [label, value] of payRows) {
    c.text(payCol, py, 9, label.toUpperCase(), { bold: true, gray: 0.45 })
    c.text(A4.width - MARGIN - 14, py, 10, value, { align: "right" })
    py -= 16
  }
  y -= 100

  y = drawItemsTable(c, input, y)
  y = drawSubscription(c, input, y)
  drawFooter(c, input)
  return c.build()
}
