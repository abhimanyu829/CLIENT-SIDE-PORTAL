import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { isR2Configured, generatePresignedGetUrl } from "@/lib/r2"
import { buildInvoicePdf } from "@/lib/invoice-pdf"

// GET /api/invoices/[id]/download
// Delivers the invoice PDF with Content-Type: application/pdf and
// Content-Disposition: attachment. Access control: owner or admin only.
//
// Two delivery paths (existing R2 architecture reused, no second system):
//   1. pdfUrl set + R2 configured  -> 302 to a fresh R2 presigned GET URL.
//   2. otherwise (pdfUrl null, R2 unconfigured, object missing, or expired
//      stored reference) -> generate the PDF on demand from invoice data and
//      stream it. This repairs existing invoices without altering records.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        payment: { select: { gatewayPaymentId: true, id: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    const role = (session.user as any).role
    const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN" || role === "ADMIN" || role === "STAFF"
    if (!isAdmin && invoice.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const filename = `${invoice.number || "invoice"}.pdf`

    // Path 1: stored R2 object via fresh presigned URL (secure, expiring).
    if (invoice.pdfUrl && isR2Configured) {
      const publicPrefix = env.NEXT_PUBLIC_R2_PUBLIC_URL ? env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/$/, "") : null
      let key: string | null = null
      if (publicPrefix && invoice.pdfUrl.startsWith(publicPrefix + "/")) {
        key = invoice.pdfUrl.slice(publicPrefix.length + 1)
      } else if (invoice.pdfUrl.startsWith("https://") || invoice.pdfUrl.startsWith("http://")) {
        // Unknown host — cannot derive a key for this bucket; fall through to
        // on-demand generation rather than leaking a raw public URL.
        key = null
      } else {
        key = invoice.pdfUrl // already a bare key
      }

      if (key) {
        try {
          const signedUrl = await generatePresignedGetUrl(key, 3600)
          return NextResponse.redirect(signedUrl, {
            headers: { "Content-Disposition": `attachment; filename="${filename}"` },
          })
        } catch (err) {
          console.error("[invoices/download] R2 presign failed, falling back to on-demand PDF:", err)
        }
      }
    }

    // Path 2: on-demand PDF from invoice data.
    const pdf = buildInvoicePdf({
      number: invoice.number,
      userName: invoice.user?.name,
      userEmail: invoice.user?.email,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      totalAmount: Number(invoice.totalAmount),
      taxAmount: Number(invoice.taxAmount),
      currency: invoice.currency,
      lineItems: invoice.lineItems as any,
      transactionRef: invoice.payment?.gatewayPaymentId ?? invoice.payment?.id ?? null,
    })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    console.error("[invoices/download] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
