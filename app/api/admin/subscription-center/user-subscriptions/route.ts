import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { z } from "zod"

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? undefined
    const planId = searchParams.get("planId") ?? undefined
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const limit = Math.min(100, Number(searchParams.get("limit") ?? 25))
    const search = searchParams.get("search") ?? undefined

    const where: any = {
      ...(status ? { status } : {}),
      ...(planId ? { planId } : {}),
      ...(search
        ? {
            OR: [
              { user: { name: { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              { subscriptionNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const [subscriptions, total] = await Promise.all([
      db.userSubscription.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          plan: { select: { id: true, name: true, tier: true, billingCycle: true } },
          addons: {
            where: { isActive: true },
            include: { addonService: { select: { id: true, name: true, unitPrice: true } } },
          },
          _count: { select: { invoices: true, payments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.userSubscription.count({ where }),
    ])

    return NextResponse.json({ success: true, data: subscriptions, total, page, limit })
  } catch (err) {
    console.error("[user-subscriptions GET]", err)
    return NextResponse.json({ success: false, error: "Failed to fetch subscriptions" }, { status: 500 })
  }
}

const createSchema = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY", "LIFETIME", "USAGE_BASED"]),
  unitPrice: z.number().min(0),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD"]).default("USD"),
  startDate: z.string().datetime().optional(),
  trialEndsAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional(),
})

function computePeriodEnd(start: Date, cycle: string): Date {
  const d = new Date(start)
  switch (cycle) {
    case "MONTHLY":      d.setMonth(d.getMonth() + 1); break
    case "QUARTERLY":    d.setMonth(d.getMonth() + 3); break
    case "SEMI_ANNUAL":  d.setMonth(d.getMonth() + 6); break
    case "YEARLY":       d.setFullYear(d.getFullYear() + 1); break
    case "LIFETIME":     d.setFullYear(d.getFullYear() + 100); break
    default:             d.setMonth(d.getMonth() + 1)
  }
  return d
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const { userId, planId, billingCycle, unitPrice, currency, startDate, trialEndsAt } = parsed.data
    const start = startDate ? new Date(startDate) : new Date()
    const periodEnd = computePeriodEnd(start, billingCycle)

    // Generate subscription number
    const subscriptionNumber = `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const subscription = await db.userSubscription.create({
      data: {
        subscriptionNumber,
        userId,
        planId,
        billingCycle,
        status: trialEndsAt ? "TRIALING" : "ACTIVE",
        unitPrice,
        totalAmount: unitPrice,
        currency,
        startDate: start,
        currentPeriodStart: start,
        currentPeriodEnd: periodEnd,
        trialStartsAt: trialEndsAt ? start : null,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        metadata: parsed.data.notes ? { adminNote: parsed.data.notes } : {},
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, tier: true } },
      },
    })

    return NextResponse.json({ success: true, data: subscription }, { status: 201 })
  } catch (err) {
    console.error("[user-subscriptions POST]", err)
    return NextResponse.json({ success: false, error: "Failed to create subscription" }, { status: 500 })
  }
}
