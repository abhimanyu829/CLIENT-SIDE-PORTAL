import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

const querySchema = z.object({
  premiumServiceId: z.string().min(1),
  serviceName: z.string().min(1).max(200),
  subject: z.string().min(3).max(300),
  message: z.string().min(10).max(5000),
})

/// POST /api/premium-service-queries
/// Authenticated user submits a pre-purchase query about a premium service.
/// Creates a Notification visible to all admins and stores a lead interaction.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Please sign in first" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = querySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 })
    }

    const { premiumServiceId, serviceName, subject, message } = parsed.data

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    })
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 401 })

    // Find all super/sub admins to notify
    const admins = await db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "SUB_ADMIN"] }, isBanned: false },
      select: { id: true },
    })

    // Fire admin notifications (non-blocking)
    const notifyAdmins = admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: `Service Query: ${serviceName}`,
        body: `${user.name ?? user.email} asked: "${subject}" — ${message.slice(0, 120)}${message.length > 120 ? "…" : ""}`,
        type: "SYSTEM",
        actionUrl: `/admin/billing-center?tab=premium-services`,
        metadata: {
          queryType: "PREMIUM_SERVICE_QUERY",
          premiumServiceId,
          serviceName,
          fromUserId: user.id,
          fromEmail: user.email,
        },
      })
    )
    await Promise.allSettled(notifyAdmins)

    // Optionally capture lead interest
    try {
      const existingLead = await db.lead.findFirst({ where: { email: user.email } })
      if (existingLead) {
        await db.lead.update({
          where: { id: existingLead.id },
          data: {
            score: { increment: 5 },
            notes: `Queried: ${serviceName}\n\nSubject: ${subject}\n\n${message}`,
            metadata: { premiumServiceId, serviceName } as any,
          },
        })
      } else {
        await db.lead.create({
          data: {
            email: user.email,
            name: user.name ?? user.email,
            source: "premium_service_query",
            stage: "NEW",
            score: 30,
            notes: `Queried: ${serviceName}\n\nSubject: ${subject}\n\n${message}`,
            metadata: { premiumServiceId, serviceName } as any,
          },
        })
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, message: "Query submitted. Our team will reach out shortly." }, { status: 201 })
  } catch (err) {
    console.error("[premium-service-queries POST]", err)
    return NextResponse.json({ success: false, error: "Unable to submit query" }, { status: 500 })
  }
}
