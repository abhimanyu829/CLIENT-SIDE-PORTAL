import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const credReq = await db.credentialRequest.findFirst({
    where: { id, userId: session.user.id, status: "APPROVED", allowDashboard: true },
    include: { product: { select: { name: true } } },
  })
  if (!credReq) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 })
  if (!credReq.credentialPayload) return NextResponse.json({ error: "No dashboard credentials available" }, { status: 404 })

  let credentials: Record<string, string>
  try {
    credentials = JSON.parse(credReq.credentialPayload)
  } catch {
    return NextResponse.json({ error: "Invalid credential payload" }, { status: 500 })
  }

  auditLog({ userId: session.user.id, action: "CREDENTIAL_VIEWED_DASHBOARD", entity: "CredentialRequest", entityId: id })
  return NextResponse.json({ success: true, data: { credentials, productName: credReq.product.name } })
}
