import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { serializePrisma } from "@/lib/serialize-prisma"

const checkoutSchema = z.object({
  servicePlanId: z.string().min(1),
  addonIds: z.array(z.string()).default([]),
})

function toMoney(value: Prisma.Decimal | number | string) {
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
  return decimal.toNumber()
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Login required" } }, { status: 401 })
    }

    const { slug } = await params
    const body = await req.json()
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid checkout payload", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }

    const servicePage = await db.servicePage.findUnique({
      where: { slug },
      include: {
        category: true,
        plans: { where: { isActive: true } },
        addOns: { where: { enabled: true } },
      },
    })

    if (!servicePage || !servicePage.isActive) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Service not found" } }, { status: 404 })
    }

    const plan = servicePage.plans.find((item) => item.id === parsed.data.servicePlanId)
    if (!plan) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Plan not found" } }, { status: 404 })
    }

    const addonSet = new Set(parsed.data.addonIds)
    const addOns = servicePage.addOns.filter((item) => addonSet.has(item.id))
    const invalidAddOn = parsed.data.addonIds.find((id) => !addOns.some((item) => item.id === id))
    if (invalidAddOn) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "One or more add-ons are not available" } }, { status: 404 })
    }
    if (addOns.some((item) => item.restricted)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "One or more add-ons are restricted" } }, { status: 403 })
    }
    if (addOns.some((item) => item.bundleOnly) && plan.type !== "SUBSCRIPTION") {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Bundle-only add-ons require a subscription plan" } }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "User account not found" } }, { status: 401 })
    }

    const planPrice = new Prisma.Decimal(plan.price)
    const addonTotal = addOns.reduce((sum, item) => sum.add(item.price), new Prisma.Decimal(0))
    const subtotal = planPrice.add(addonTotal)
    const discountTotal = new Prisma.Decimal(0)
    const taxTotal = new Prisma.Decimal(0)
    const grandTotal = subtotal.add(taxTotal).sub(discountTotal)
    const orderNumber = `SVC-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`

    const order = await db.serviceOrder.create({
      data: {
        orderNumber,
        userId: user.id,
        servicePageId: servicePage.id,
        servicePlanId: plan.id,
        status: "PENDING_PAYMENT",
        currency: plan.currency || "USD",
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        billingSnapshot: {
          servicePage: {
            id: servicePage.id,
            slug: servicePage.slug,
            title: servicePage.title,
            category: servicePage.category?.name ?? null,
          },
          plan: {
            id: plan.id,
            name: plan.name,
            type: plan.type,
            billingLabel: plan.billingLabel,
            price: toMoney(plan.price),
            currency: plan.currency,
          },
          addOns: addOns.map((item) => ({
            id: item.id,
            name: item.name,
            price: toMoney(item.price),
            currency: item.currency,
          })),
        },
        metadata: {
          source: "service-checkout",
          requestedBy: user.email,
        },
        lines: {
          create: [
            {
              lineType: "PLAN",
              servicePlanId: plan.id,
              name: plan.name,
              quantity: 1,
              unitPrice: planPrice,
              totalPrice: planPrice,
              currency: plan.currency || "USD",
              snapshot: {
                id: plan.id,
                type: plan.type,
                billingLabel: plan.billingLabel,
                price: toMoney(plan.price),
              },
            },
            ...addOns.map((item) => ({
              lineType: "ADDON" as const,
              serviceAddonId: item.id,
              name: item.name,
              quantity: 1,
              unitPrice: item.price,
              totalPrice: item.price,
              currency: item.currency,
              snapshot: {
                id: item.id,
                enabled: item.enabled,
                bundleOnly: item.bundleOnly,
                restricted: item.restricted,
                price: toMoney(item.price),
              },
            })),
          ],
        },
      },
      include: {
        servicePage: { select: { title: true, slug: true } },
        servicePlan: { select: { id: true, name: true, type: true, billingLabel: true } },
        lines: true,
      },
    })

    return NextResponse.json({ success: true, data: serializePrisma(order) }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/public/services/[slug]/checkout")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
