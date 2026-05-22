import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { PaymentGateway } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createOrderFromActiveCart, markOrderPaid } from "@/lib/services/enterprise-commerce-service"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await db.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true, tier: true } }, invoices: true, payments: true },
  })

  return NextResponse.json({ data: orders })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const gateway = (body.gateway ?? "STRIPE") as PaymentGateway
  if (!Object.values(PaymentGateway).includes(gateway)) {
    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 })
  }

  const order = await createOrderFromActiveCart({
    userId: session.user.id,
    gateway,
    couponCode: body.couponCode,
    affiliateCode: body.affiliateCode,
    referralCode: body.referralCode,
  })

  return NextResponse.json({ data: order }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  if (!body.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 })
  }

  const order = await markOrderPaid(body.orderId, body.gatewayPaymentId)
  return NextResponse.json({ data: order })
}
