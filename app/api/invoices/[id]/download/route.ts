import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/invoices/[id]/download — return invoice PDF URL
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoice = await db.invoice.findUnique({
      where: { id },
      select: { userId: true, pdfUrl: true, number: true },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    const role = (session.user as any).role
    const isAdmin = role === "ADMIN" || role === "STAFF"

    if (!isAdmin && invoice.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!invoice.pdfUrl) {
      return NextResponse.json({ error: "PDF not yet generated" }, { status: 404 })
    }

    return NextResponse.json({ data: { url: invoice.pdfUrl, number: invoice.number } })
  } catch (err) {
    console.error("[invoices/download] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
