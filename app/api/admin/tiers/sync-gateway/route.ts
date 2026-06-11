import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import Stripe from "stripe"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
    // Zero-trust: refetch role from DB
    const dbUser = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    if (!dbUser || (dbUser.role !== "SUPER_ADMIN" && dbUser.role !== "SUB_ADMIN")) {
      return new NextResponse("Forbidden", { status: 403 })
    }

    const data = await req.json()
    const { name, description, price, currency, interval, productId } = data

    if (!name || price === undefined) {
      return new NextResponse("Name and Price are required", { status: 400 })
    }

    let stripePriceId: string | null = null
    let stripeProductId: string | null = null
    let razorpayPlanId = `plan_${Math.random().toString(36).substr(2, 9)}` // Mock Razorpay Plan ID for now since no SDK is present

    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2024-04-10" as any,
      })

      // Create Product
      const product = await stripe.products.create({
        name: name,
        description: description || undefined,
        metadata: {
          appProductId: productId || "unlinked",
        }
      })
      stripeProductId = product.id

      // Create Price
      const stripeInterval = interval === "YEARLY" ? "year" : interval === "MONTHLY" ? "month" : null
      
      const priceParams: Stripe.PriceCreateParams = {
        product: product.id,
        unit_amount: Math.round(price * 100), // Convert to cents
        currency: (currency || "USD").toLowerCase(),
      }

      if (stripeInterval) {
        priceParams.recurring = { interval: stripeInterval }
      }

      const priceObj = await stripe.prices.create(priceParams)
      stripePriceId = priceObj.id
    }

    return NextResponse.json({
      stripePriceId,
      stripeProductId,
      razorpayPlanId
    })
  } catch (error: any) {
    console.error("Gateway sync error:", error)
    return new NextResponse(error.message || "Internal Server Error", { status: 500 })
  }
}
