"use client"

import { useState } from "react"

interface CouponFieldProps {
  tierId: string
  onCouponApplied: (coupon: { type: string, discountValue: number }) => void
}

export function CouponField({ tierId, onCouponApplied }: CouponFieldProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleApplyCoupon = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/payments/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tierId }),
    })
    const { data, error } = await res.json()
    if (error) {
      setError(error.message)
    } else {
      onCouponApplied(data)
    }
    setLoading(false)
  }

  return (
    <div>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Coupon Code"
      />
      <button onClick={handleApplyCoupon} disabled={loading}>{loading ? "Applying..." : "Apply"}</button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  )
}
