"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Minus, Plus, ShoppingCart, Tag, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Cart = {
  id: string
  subtotal: string
  discountTotal: string
  taxTotal: string
  grandTotal: string
  currency: string
  couponCode?: string | null
  items: Array<{
    id: string
    quantity: number
    unitPrice: string
    currency: string
    product: { name: string; slug: string; type: string; thumbnailUrl?: string | null }
    tier?: { name: string; interval: string } | null
  }>
}

function money(value: number | string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(value || 0))
}

export default function CartClient() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [coupon, setCoupon] = useState("")
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totals = useMemo(() => ({
    subtotal: Number(cart?.subtotal ?? 0),
    discount: Number(cart?.discountTotal ?? 0),
    tax: Number(cart?.taxTotal ?? 0),
    total: Number(cart?.grandTotal ?? 0),
  }), [cart])

  const refresh = async () => {
    const res = await fetch("/api/cart")
    const json = await res.json()
    setCart(json.data)
    setCoupon(json.data?.couponCode ?? "")
  }

  useEffect(() => {
    refresh().catch(() => setError("Unable to load cart.")).finally(() => setLoading(false))
  }, [])

  const updateQuantity = async (itemId: string, quantity: number) => {
    setUpdating(itemId)
    setError(null)
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_quantity", itemId, quantity }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Unable to update cart.")
      setCart(json.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  const applyCoupon = async () => {
    setUpdating("coupon")
    setError(null)
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: coupon ? "apply_coupon" : "remove_coupon", couponCode: coupon }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Unable to apply coupon.")
      setCart(json.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 p-8 text-zinc-400">Loading cart...</div>
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-md rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center">
          <ShoppingCart className="mx-auto mb-3 h-9 w-9 text-zinc-500" />
          <h1 className="text-2xl font-black">Your cart is empty</h1>
          <p className="mt-2 text-sm text-zinc-500">Add SaaS plans, AI agents, APIs, services, or add-ons from the marketplace.</p>
          <Button asChild className="mt-5">
            <Link href="/marketplace">Browse marketplace</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-white">
      <main className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_380px]">
        <section className="rounded-lg border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 p-5">
            <h1 className="text-2xl font-black">Enterprise cart</h1>
            <p className="mt-1 text-sm text-zinc-500">Persistent, account-aware, tax and coupon validated before Razorpay checkout.</p>
          </div>

          {error && <div className="mx-5 mt-5 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

          <div className="divide-y divide-white/10">
            {cart.items.map((item) => (
              <div key={item.id} className="grid gap-4 p-5 md:grid-cols-[72px_1fr_auto]">
                <div className="h-16 w-16 overflow-hidden rounded-md bg-zinc-900">
                  {item.product.thumbnailUrl ? (
                    <img src={item.product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center"><ShoppingCart className="h-5 w-5 text-zinc-500" /></div>
                  )}
                </div>
                <div>
                  <Link href={`/marketplace/${item.product.slug}`} className="font-semibold hover:text-blue-300">{item.product.name}</Link>
                  <p className="mt-1 text-sm text-zinc-500">{item.tier?.name ?? "Default"} · {item.product.type.replaceAll("_", " ")}</p>
                  <div className="mt-3 flex w-fit items-center gap-1 rounded-md border border-white/10 bg-zinc-950/70 p-1">
                    <button aria-label="Decrease quantity" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={updating === item.id} className="rounded p-1 hover:bg-white/10">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                    <button aria-label="Increase quantity" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={updating === item.id} className="rounded p-1 hover:bg-white/10">
                      <Plus className="h-4 w-4" />
                    </button>
                    <button aria-label="Remove item" onClick={() => updateQuantity(item.id, 0)} disabled={updating === item.id} className="ml-2 rounded p-1 text-red-300 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{money(Number(item.unitPrice) * item.quantity, item.currency)}</p>
                  <p className="text-xs text-zinc-600">{money(item.unitPrice, item.currency)} each</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-bold">Checkout summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-zinc-400"><span>Subtotal</span><span>{money(totals.subtotal, cart.currency)}</span></div>
            <div className="flex justify-between text-zinc-400"><span>Discount</span><span>-{money(totals.discount, cart.currency)}</span></div>
            <div className="flex justify-between text-zinc-400"><span>Tax</span><span>{money(totals.tax, cart.currency)}</span></div>
            <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-black"><span>Total</span><span>{money(totals.total, cart.currency)}</span></div>
          </div>

          <div className="mt-5 flex gap-2">
            <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon" className="border-white/10 bg-zinc-950" />
            <Button variant="outline" onClick={applyCoupon} disabled={updating === "coupon"} className="border-white/10 bg-transparent">
              <Tag className="h-4 w-4" />
            </Button>
          </div>

          <Button asChild className="mt-5 w-full">
            <Link href="/checkout">Proceed to Razorpay checkout</Link>
          </Button>
        </aside>
      </main>
    </div>
  )
}
