"use client"

import { useState } from "react"
import Link from "next/link"

const S = `
.pay-glass{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:1.25rem;overflow:hidden}
.pay-input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:.875rem;padding:.875rem 1rem;font-size:.875rem;color:#fff;outline:none;transition:border-color .2s}
.pay-input:focus{border-color:rgba(139,92,246,.5)}
.pay-label{font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.35);margin-bottom:.5rem;display:block}
.pay-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.875rem;padding:.9rem 1.5rem;font-weight:800;color:#fff;width:100%;transition:all .2s;cursor:pointer;font-size:.9375rem}
.pay-btn:hover{opacity:.9;transform:scale(1.01)}
.pay-btn:disabled{opacity:.4;transform:none;cursor:not-allowed}
.pay-card-chip{border-radius:.35rem;width:2rem;height:1.5rem;background:linear-gradient(135deg,#fbbf24,#f59e0b)}
.pay-card-preview{background:linear-gradient(135deg,rgba(99,102,241,.3),rgba(139,92,246,.2));border:1px solid rgba(139,92,246,.25);border-radius:1rem;padding:1.25rem;aspect-ratio:1.6}
.pay-method-selected{border-color:rgba(139,92,246,.5)!important;background:rgba(139,92,246,.08)!important}
`

// ─── CHECKOUT FORM ────────────────────────────────────────────────────────────
interface CheckoutFormProps {
  planName: string
  planPrice: number
  onSubmit?: (data: Record<string, string>) => void
  loading?: boolean
}

export function CheckoutForm({ planName, planPrice, onSubmit, loading }: CheckoutFormProps) {
  const [form, setForm] = useState({ name:"", email:"", card:"", expiry:"", cvc:"" })
  const [payMethod, setPayMethod] = useState<"card" | "upi">("card")

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const fmtCard = (v: string) => v.replace(/\D/g,"").slice(0,16).replace(/(\d{4})/g,"$1 ").trim()
  const fmtExpiry = (v: string) => v.replace(/\D/g,"").slice(0,4).replace(/(\d{2})(\d)/,"$1/$2")

  return (
    <div className="space-y-5">
      <style>{S}</style>

      {/* Card Preview */}
      <div className="pay-card-preview">
        <div className="flex items-start justify-between mb-8">
          <div className="pay-card-chip" />
          <span className="text-xs text-zinc-400 font-mono">{form.card ? form.card : "•••• •••• •••• ••••"}</span>
        </div>
        <p className="text-base font-mono tracking-widest text-white/80">{form.card || "•••• •••• •••• ••••"}</p>
        <div className="flex justify-between mt-3">
          <p className="text-xs text-zinc-500">{form.name || "CARD HOLDER"}</p>
          <p className="text-xs text-zinc-500">{form.expiry || "MM/YY"}</p>
        </div>
      </div>

      {/* Payment Method Tabs */}
      <div className="flex gap-2">
        {(["card","upi"] as const).map(m => (
          <button key={m} onClick={() => setPayMethod(m)}
            className={`pay-glass flex-1 py-2.5 text-sm font-bold transition-all uppercase tracking-widest ${payMethod === m ? "pay-method-selected text-purple-300" : "text-zinc-600"}`}
            style={{borderRadius:".875rem"}}>
            {m === "card" ? "💳 Card" : "📲 UPI"}
          </button>
        ))}
      </div>

      {payMethod === "card" && (
        <div className="space-y-3">
          <div>
            <label className="pay-label">Cardholder Name</label>
            <input value={form.name} onChange={set("name")} placeholder="John Smith"
              className="pay-input" autoComplete="name" />
          </div>
          <div>
            <label className="pay-label">Card Number</label>
            <input value={fmtCard(form.card)} onChange={e => setForm(p => ({...p,card:e.target.value.replace(/\s/g,"")}))}
              placeholder="4242 4242 4242 4242" maxLength={19}
              className="pay-input font-mono" autoComplete="cc-number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="pay-label">Expiry</label>
              <input value={fmtExpiry(form.expiry)} onChange={e => setForm(p => ({...p,expiry:e.target.value}))}
                placeholder="MM/YY" maxLength={5}
                className="pay-input font-mono" autoComplete="cc-exp" />
            </div>
            <div>
              <label className="pay-label">CVC</label>
              <input value={form.cvc} onChange={set("cvc")} placeholder="•••" maxLength={4} type="password"
                className="pay-input font-mono" autoComplete="cc-csc" />
            </div>
          </div>
        </div>
      )}

      {payMethod === "upi" && (
        <div>
          <label className="pay-label">UPI ID</label>
          <input placeholder="yourname@upi" className="pay-input" />
        </div>
      )}

      <button onClick={() => onSubmit?.(form)} disabled={loading}
        className="pay-btn">
        {loading ? "Processing..." : `Pay $${(planPrice / 100).toFixed(2)} — ${planName}`}
      </button>

      <p className="text-center text-xs text-zinc-700">
        🔒 256-bit SSL encrypted · Powered by Stripe
      </p>
    </div>
  )
}

// ─── ORDER SUMMARY ────────────────────────────────────────────────────────────
interface OrderSummaryProps {
  plan: string
  price: number
  period?: string
  features?: string[]
  couponDiscount?: number
  tax?: number
}

export function OrderSummary({ plan, price, period = "month", features = [], couponDiscount = 0, tax = 0 }: OrderSummaryProps) {
  const subtotal = price
  const discount = couponDiscount
  const taxAmt = Math.round(subtotal * tax)
  const total = subtotal - discount + taxAmt

  return (
    <div className="pay-glass p-5 space-y-4">
      <style>{S}</style>
      <div>
        <p className="text-xs text-zinc-600 font-semibold uppercase tracking-widest mb-1">Order Summary</p>
        <p className="font-black text-lg">{plan} Plan</p>
        <p className="text-xs text-zinc-600">Billed monthly · Cancel anytime</p>
      </div>

      {features.length > 0 && (
        <div className="space-y-1.5 py-3 border-y border-white/5">
          {features.map(f => (
            <p key={f} className="text-xs text-zinc-500 flex gap-2">
              <span className="text-purple-400">✓</span> {f}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-600">Subtotal</span>
          <span className="font-semibold">${(subtotal / 100).toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-400">
            <span>Coupon discount</span>
            <span>−${(discount / 100).toFixed(2)}</span>
          </div>
        )}
        {taxAmt > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>Tax ({(tax * 100).toFixed(0)}%)</span>
            <span>${(taxAmt / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-black text-base pt-2 border-t border-white/5">
          <span>Total</span>
          <span className="text-white">${(total / 100).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── PAYMENT METHOD CARD ───────────────────────────────────────────────────────
interface PaymentMethodCardProps {
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  isDefault?: boolean
  onSetDefault?: () => void
  onRemove?: () => void
}

export function PaymentMethodCard({ brand = "Visa", last4 = "4242", expMonth, expYear, isDefault, onSetDefault, onRemove }: PaymentMethodCardProps) {
  const brandIcon = brand.toLowerCase() === "mastercard" ? "◉" : brand.toLowerCase() === "amex" ? "✦" : "💳"

  return (
    <div className={`pay-glass flex items-center gap-4 px-4 py-3 ${isDefault ? "pay-method-selected" : ""}`}
      style={{borderRadius:"1rem"}}>
      <style>{S}</style>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
        style={{background:"rgba(255,255,255,.06)"}}>
        {brandIcon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{brand} •••• {last4}</p>
        {expMonth && expYear && (
          <p className="text-xs text-zinc-600">Expires {expMonth}/{expYear}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isDefault && (
          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">DEFAULT</span>
        )}
        {!isDefault && onSetDefault && (
          <button onClick={onSetDefault} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">Set default</button>
        )}
        {onRemove && (
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
        )}
      </div>
    </div>
  )
}

// ─── UPGRADE PROMPT ──────────────────────────────────────────────────────────
interface UpgradePromptProps {
  reason?: string
  currentPlan?: string
  targetPlan?: string
  onUpgrade?: () => void
  compact?: boolean
}

export function UpgradePrompt({ reason = "You've reached your plan limit", currentPlan = "Free", targetPlan = "Pro", onUpgrade, compact }: UpgradePromptProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.2)"}}>
        <style>{S}</style>
        <span className="text-purple-400">⬡</span>
        <p className="text-xs text-zinc-400 flex-1">{reason}</p>
        <button onClick={onUpgrade}
          className="text-xs font-bold text-purple-300 hover:text-purple-200 whitespace-nowrap transition-colors">
          Upgrade →
        </button>
      </div>
    )
  }

  return (
    <div className="pay-glass p-6 text-center"
      style={{borderColor:"rgba(139,92,246,.25)",background:"rgba(139,92,246,.07)"}}>
      <style>{S}</style>
      <div className="text-4xl mb-3">✦</div>
      <p className="font-black text-lg mb-1">{reason}</p>
      <p className="text-sm text-zinc-600 mb-5">
        You&apos;re on the <strong className="text-zinc-400">{currentPlan}</strong> plan.
        Upgrade to <strong className="text-purple-400">{targetPlan}</strong> to unlock more.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onUpgrade} className="pay-btn" style={{width:"auto",padding:".75rem 2rem"}}>
          Upgrade to {targetPlan} →
        </button>
        <Link href="/dashboard/subscriptions">
          <button style={{border:"1px solid rgba(255,255,255,.12)",borderRadius:".875rem",padding:".75rem 1.5rem",fontSize:".875rem",fontWeight:700,color:"rgba(255,255,255,.5)",transition:"all .2s"}}>
            View all plans
          </button>
        </Link>
      </div>
    </div>
  )
}
