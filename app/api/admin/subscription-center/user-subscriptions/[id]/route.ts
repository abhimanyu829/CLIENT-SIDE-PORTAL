import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    const sub = await db.userSubscription.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        plan: { include: { benefits: { orderBy: { sortOrder: "asc" } } } },
        addons: {
          include: {
            addonService: true,
          },
          orderBy: { addedAt: "asc" },
        },
        invoices: { orderBy: { createdAt: "desc" }, take: 10 },
        payments: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    })

    if (!sub) return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: sub })
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to fetch subscription" }, { status: 500 })
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), immediate: z.boolean().default(false) }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("change_plan"), planId: z.string() }),
  z.object({ action: z.literal("extend"), days: z.number().int().positive() }),
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const now = new Date()
    let updateData: any = {}

    switch (parsed.data.action) {
      case "cancel":
        updateData = parsed.data.immediate
          ? { status: "CANCELED", canceledAt: now, endedAt: now, cancelAtPeriodEnd: false }
          : { cancelAtPeriodEnd: true, canceledAt: now }
        break

      case "reactivate": {
        const sub = await db.userSubscription.findUnique({ where: { id } })
        if (!sub) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
        updateData = {
          status: "ACTIVE",
          canceledAt: null,
          endedAt: null,
          cancelAtPeriodEnd: false,
        }
        break
      }

      case "pause":
        updateData = { status: "PAUSED" }
        break

      case "change_plan": {
        const plan = await db.subscriptionPlan.findUnique({ where: { id: parsed.data.planId } })
        if (!plan) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 })
        updateData = {
          planId: parsed.data.planId,
          unitPrice: plan.price,
          totalAmount: plan.price,
          billingCycle: plan.billingCycle,
        }
        break
      }

      case "extend": {
        const sub = await db.userSubscription.findUnique({ where: { id } })
        if (!sub) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
        const newEnd = new Date(sub.currentPeriodEnd)
        newEnd.setDate(newEnd.getDate() + parsed.data.days)
        updateData = { currentPeriodEnd: newEnd }
        break
      }
    }

    const updated = await db.userSubscription.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, data: updated })
  } catch (err: any) {
    if (err?.code === "P2025") return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
    console.error("[user-subscription PATCH]", err)
    return NextResponse.json({ success: false, error: "Action failed" }, { status: 500 })
  }
}
