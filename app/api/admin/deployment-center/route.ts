import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"

/// Deployment Center list: every purchased service awaiting (or past)
/// deployment, with customer, order, payment, and queue context.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const status = req.nextUrl.searchParams.get("status") // PurchasedServiceStatus
    const deploymentStatus = req.nextUrl.searchParams.get("deploymentStatus")
    const search = req.nextUrl.searchParams.get("search")?.trim()

    const where: Prisma.PurchasedServiceWhereInput = {}
    if (status) where.status = status as any
    else where.status = { not: "DELETED" } // hide soft-deleted unless explicitly requested
    if (deploymentStatus) where.deployment = { is: { status: deploymentStatus as any } }
    if (search) {
      where.OR = [
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { order: { orderNumber: { contains: search, mode: "insensitive" } } },
        { orderItem: { name: { contains: search, mode: "insensitive" } } },
      ]
    }

    const services = await db.purchasedService.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: {
          select: {
            id: true, orderNumber: true, grandTotal: true, currency: true, paidAt: true, gateway: true,
            payments: { select: { status: true, amount: true, gateway: true }, take: 1, orderBy: { createdAt: "desc" } },
          },
        },
        orderItem: { select: { name: true, unitPrice: true, currency: true, tier: { select: { name: true, interval: true } } } },
        product: { select: { name: true, slug: true, version: true } },
        deployment: true,
        upgrades: { where: { status: { in: ["PENDING", "PAID"] } }, select: { id: true, status: true, snapshot: true } },
      },
      orderBy: [{ deploymentPriority: "desc" }, { createdAt: "asc" }],
      take: 200,
    })

    return NextResponse.json({ success: true, data: services })
  } catch (err) {
    console.error("[admin/deployment-center GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load deployments" }, { status: 500 })
  }
}
