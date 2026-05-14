"use client"

import { useState } from "react"
import { env } from "@/lib/env"

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayButtonProps {
  tierId: string
}

export function RazorpayButton({ tierId }: RazorpayButtonProps) {
  const [loading, setLoading] = useState(false)

  const handlePayment = async () => {
    setLoading(true)
    const orderRes = await fetch("/api/payments/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId }),
    })
    const { data: order } = await orderRes.json()

    const options = {
      key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: "Your SaaS Platform",
      description: "Test Transaction",
      order_id: order.id,
      handler: async function (response: any) {
        await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...response, tierId }),
        })
      },
    }

    const rzp = new window.Razorpay(options)
    rzp.open()
    setLoading(false)
  }

  return <button onClick={handlePayment} disabled={loading}>{loading ? "Processing..." : "Pay with Razorpay"}</button>
}
