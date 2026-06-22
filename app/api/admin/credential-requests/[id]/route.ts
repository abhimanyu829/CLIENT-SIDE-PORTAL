import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { resend } from "@/lib/resend"
import { env } from "@/lib/env"

const EMAIL_FROM = env.EMAIL_FROM || "NexusAI <onboarding@resend.dev>"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const { action, username, password, notes, allowDashboard } = body

    const credReq = await db.credentialRequest.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, productLoginUrl: true } },
      },
    })
    if (!credReq) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (action === "APPROVE") {
      const payload = JSON.stringify({
        username: username ?? "",
        password: password ?? "",
        notes: notes ?? "",
      })

      const updated = await db.credentialRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          deliveredUsername: username ?? null,
          deliveredPassword: password ?? null,
          adminNotes: notes ?? null,
          allowDashboard: !!allowDashboard,
          credentialPayload: allowDashboard ? payload : null,
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
        },
      })

      // Send credential email via Resend directly (HTML)
      if (resend) {
        const loginUrlRow = credReq.product.productLoginUrl
          ? `<tr><td style="padding:8px 0;color:#6B7280;font-size:13px;font-weight:600;width:120px">Login URL</td><td style="padding:8px 0;font-size:13px"><a href="${credReq.product.productLoginUrl}" style="color:#6366f1">${credReq.product.productLoginUrl}</a></td></tr>`
          : ""
        const notesRow = notes
          ? `<tr><td style="padding:8px 0;color:#6B7280;font-size:13px;font-weight:600">Notes</td><td style="padding:8px 0;font-size:13px">${notes}</td></tr>`
          : ""

        await resend.emails.send({
          from: EMAIL_FROM,
          to: credReq.user.email,
          subject: `Your Login Credentials – ${credReq.product.name}`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb">
              <div style="margin-bottom:24px">
                <h2 style="margin:0 0 6px;color:#111827;font-size:20px;font-weight:700">Login Credentials</h2>
                <p style="margin:0;color:#6B7280;font-size:14px">For <strong>${credReq.product.name}</strong></p>
              </div>
              <p style="color:#374151;font-size:14px;margin:0 0 20px">Hello ${credReq.user.name},<br>Your login credentials have been approved. Please find them below.</p>
              <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;padding:16px;display:block">
                ${loginUrlRow}
                <tr><td style="padding:8px 0;color:#6B7280;font-size:13px;font-weight:600;width:120px">Username</td><td style="padding:8px 0;font-family:monospace;font-size:13px">${username ?? "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7280;font-size:13px;font-weight:600">Password</td><td style="padding:8px 0;font-family:monospace;font-size:13px">${password ?? "—"}</td></tr>
                ${notesRow}
              </table>
              <p style="color:#9CA3AF;font-size:11px;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px">Keep these credentials secure. NexusAI will never ask for your password via chat or email.</p>
            </div>
          `,
        })
      }

      auditLog({
        userId: session.user.id,
        action: "CREDENTIAL_REQUEST_APPROVED",
        entity: "CredentialRequest",
        entityId: id,
      })
      return NextResponse.json({ success: true, data: updated })
    }

    if (action === "REJECT") {
      const updated = await db.credentialRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          adminNotes: notes ?? null,
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
        },
      })
      auditLog({
        userId: session.user.id,
        action: "CREDENTIAL_REQUEST_REJECTED",
        entity: "CredentialRequest",
        entityId: id,
      })
      return NextResponse.json({ success: true, data: updated })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
