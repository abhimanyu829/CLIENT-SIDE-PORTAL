"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Minus, Plus, ShoppingCart, Tag, Trash2, ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react"
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
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-foreground/70">
        <div className="flex items-center gap-3 bg-muted/60 backdrop-blur-xl border border-border px-6 py-4 rounded-2xl shadow-lg animate-pulse">
          <div className="h-5 w-5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
          <span className="text-sm font-semibold">Loading enterprise cart…</span>
        </div>
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-[85vh] bg-white dark:bg-zinc-950 px-4 py-16 text-foreground flex items-center justify-center">
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-white dark:bg-zinc-900 p-8 md:p-10 text-center shadow-xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 shadow-inner">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Your cart is empty</h1>
          <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
            Add SaaS plans, AI agents, APIs, services, or add-ons from our marketplace to get started.
          </p>
          <Button asChild className="mt-6 w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md hover:shadow-amber-500/20 transition-all py-6">
            <Link href="/marketplace" className="flex items-center justify-center gap-2">
              <span>Browse marketplace</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 py-8 md:py-12 text-foreground">
      <main className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_390px]">
        {/* Main Cart Items Section */}
        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-semibold uppercase tracking-wider mb-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live Order Items
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Enterprise Cart</h1>
                <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                  Persistent, account-aware, tax and coupon validated before Razorpay checkout.
                </p>
              </div>
              <span className="self-start sm:self-center px-3.5 py-1.5 rounded-full bg-muted border border-border text-xs font-bold text-foreground">
                {cart.items.length} {cart.items.length === 1 ? "item" : "items"}
              </span>
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300 font-medium">
                {error}
              </div>
            )}

            <div className="divide-y divide-border mt-2">
              {cart.items.map((item) => (
                <div key={item.id} className="grid gap-5 py-6 md:grid-cols-[80px_1fr_auto] items-center transition-colors">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-muted border border-border shrink-0 shadow-sm">
                    {item.product.thumbnailUrl ? (
                      <img src={item.product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <ShoppingCart className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Link href={`/marketplace/${item.product.slug}`} className="text-base font-bold text-foreground hover:text-amber-600 transition-colors">
                      {item.product.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-2.5 py-0.5 rounded-md bg-muted border border-border font-medium text-foreground">
                        {item.tier?.name ?? "Default"}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{item.product.type.replaceAll("_", " ")}</span>
                    </div>

                    {/* Quantity Selector Counter */}
                    <div className="mt-4 flex items-center gap-2">
                      <div className="inline-flex items-center rounded-xl border border-border bg-muted/50 p-1 shadow-sm">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={updating === item.id}
                          className="rounded-lg p-1.5 text-foreground/80 hover:bg-background hover:text-foreground transition-all disabled:opacity-50"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-10 text-center text-sm font-bold text-foreground">
                          {updating === item.id ? "…" : item.quantity}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={updating === item.id}
                          className="rounded-lg p-1.5 text-foreground/80 hover:bg-background hover:text-foreground transition-all disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        aria-label="Remove item"
                        onClick={() => updateQuantity(item.id, 0)}
                        disabled={updating === item.id}
                        className="rounded-xl border border-transparent p-2 text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-left md:text-right shrink-0">
                    <p className="text-lg font-extrabold text-foreground">
                      {money(Number(item.unitPrice) * item.quantity, item.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {money(item.unitPrice, item.currency)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sidebar Order Summary */}
        <aside className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="text-xl font-extrabold tracking-tight border-b border-border pb-4">Checkout Summary</h2>
            
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-semibold text-foreground">{money(totals.subtotal, cart.currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">-{money(totals.discount, cart.currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Estimated Tax</span>
                <span className="font-semibold text-foreground">{money(totals.tax, cart.currency)}</span>
              </div>

              <div className="border-t border-border pt-4 flex justify-between items-baseline">
                <div>
                  <span className="text-base font-extrabold text-foreground">Total</span>
                  <p className="text-[11px] text-muted-foreground">Includes all applicable taxes</p>
                </div>
                <span className="text-2xl font-black text-foreground bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 bg-clip-text text-transparent">
                  {money(totals.total, cart.currency)}
                </span>
              </div>
            </div>

            {/* Coupon Code Section */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Have a coupon?</label>
              <div className="flex gap-2">
                <Input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="rounded-xl border-border bg-muted/40 font-mono uppercase tracking-wider text-sm focus:ring-2 focus:ring-amber-500/30"
                />
                <Button
                  variant="outline"
                  onClick={applyCoupon}
                  disabled={updating === "coupon"}
                  className="rounded-xl border-border hover:bg-muted font-bold px-4 shrink-0"
                >
                  <Tag className="h-4 w-4 mr-1.5" />
                  <span>Apply</span>
                </Button>
              </div>
            </div>

            {/* Proceed to Checkout CTA */}
            <Button asChild className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold text-base py-6 shadow-md hover:shadow-amber-500/20 active:scale-[0.99] transition-all">
              <Link href="/checkout" className="flex items-center justify-center gap-2">
                <span>Proceed to Razorpay Checkout</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          {/* Trust Highlights */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>256-bit SSL encrypted & Razorpay secured</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Instant provisioning upon webhook confirmation</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

