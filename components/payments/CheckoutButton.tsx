"use client"

import { useState } from "react"
import { getStripe } from "@/lib/stripe"

interface CheckoutButtonProps {
  tierId: string
}

export function CheckoutButton({ tierId }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId }),
    })
    const { data } = await res.json()
    const stripe = await getStripe()
    await stripe.redirectToCheckout({ sessionId: data.checkoutUrl.split("/").pop() })
    setLoading(false)
  }

  return <button onClick={handleCheckout} disabled={loading}>{loading ? "Processing..." : "Buy Now"}</button>
}
