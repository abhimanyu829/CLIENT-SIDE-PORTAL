import Stripe from "stripe"
import { env } from "@/lib/env"

// Stripe server-side client — only used in Node.js API routes, never in Edge
export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY as string, {
      apiVersion: "2025-04-30" as any,
    })
  : null

let stripePromise: Promise<any> | null = null

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = import("@stripe/stripe-js").then((stripeJs) =>
      stripeJs.loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")
    )
  }
  return stripePromise
}

export { getStripe }
