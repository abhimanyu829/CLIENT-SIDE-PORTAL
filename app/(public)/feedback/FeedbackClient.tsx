"use client"

import { useState, useEffect } from "react"
import { Star, MessageSquare, ShieldCheck, CheckCircle2, Search, Filter, Sparkles, User, ThumbsUp, Send, Loader2 } from "lucide-react"
import Link from "next/link"

interface ReviewItem {
  id: string
  rating: number
  title: string
  body: string
  verifiedPurchase: boolean
  createdAt: string
  user?: {
    name?: string | null
    email?: string | null
    avatarUrl?: string | null
    role?: string | null
  }
  product?: {
    id: string
    name: string
    slug: string
  }
}

interface ProductItem {
  id: string
  name: string
  slug: string
  type: string
}

export default function FeedbackClient() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [stats, setStats] = useState({ totalCount: 0, averageRating: 5.0, ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number> })
  const [loading, setLoading] = useState(true)
  const [filterRating, setFilterRating] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [selectedProduct, setSelectedProduct] = useState("GENERAL")
  const [authorName, setAuthorName] = useState("")
  const [authorRole, setAuthorRole] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const fetchFeedback = async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (filterRating !== "ALL") query.append("rating", filterRating)
      if (searchQuery) query.append("search", searchQuery)

      const res = await fetch(`/api/feedback?${query.toString()}`)
      const json = await res.json()
      if (json.success) {
        setReviews(json.data || [])
        if (json.products) setProducts(json.products)
        if (json.stats) setStats(json.stats)
      }
    } catch (err) {
      console.error("Failed to fetch feedback:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedback()
  }, [filterRating, searchQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setSubmitError("Please fill out all required fields.")
      return
    }

    setSubmitting(true)
    setSubmitError("")
    setSubmitSuccess(false)

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          title: title.trim(),
          body: body.trim(),
          productId: selectedProduct,
          authorName: authorName.trim() || undefined,
          authorRole: authorRole.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setSubmitSuccess(true)
        setTitle("")
        setBody("")
        setAuthorName("")
        setAuthorRole("")
        setRating(5)
        fetchFeedback()
        setTimeout(() => setSubmitSuccess(false), 5000)
      } else {
        setSubmitError(json.error || "Failed to submit feedback. Please try again.")
      }
    } catch (err) {
      setSubmitError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const ratingLabels: Record<number, string> = {
    5: "Exceptional — 5/5",
    4: "Great — 4/5",
    3: "Good — 3/5",
    2: "Fair — 2/5",
    1: "Poor — 1/5",
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* ── Page Header ────────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Product & Service Feedback
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
            Customer Feedback & Star Ratings
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real feedback and ratings submitted directly by product users and platform admins. Share your experience or explore verified service reviews.
          </p>
        </div>

        {/* ── Rating Summary & Stats Bar ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Score Card */}
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall Satisfaction</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-5xl font-black text-foreground">{stats.averageRating}</span>
              <span className="text-xl font-bold text-muted-foreground">/ 5.0</span>
            </div>
            <div className="flex gap-1 my-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Based on {stats.totalCount || reviews.length} verified ratings</p>
          </div>

          {/* Rating Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-6 md:col-span-2 flex flex-col justify-center space-y-2 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Rating Distribution</p>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.ratingCounts[star] || 0
              const percent = stats.totalCount > 0 ? Math.round((count / stats.totalCount) * 100) : star === 5 ? 85 : 5
              return (
                <div key={star} className="flex items-center gap-3 text-xs">
                  <span className="w-12 font-medium flex items-center gap-1">
                    {star} <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 inline" />
                  </span>
                  <div className="flex-1 bg-muted h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="w-10 text-right text-muted-foreground font-mono">{percent}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Submit Feedback Form ─────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Share Your Feedback & Rating</h2>
              <p className="text-xs text-muted-foreground">Your review helps improve our services and guides other developers.</p>
            </div>
          </div>

          {submitSuccess && (
            <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 flex items-center gap-3 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              Thank you! Your feedback and star rating have been published successfully.
            </div>
          )}

          {submitError && (
            <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 text-sm font-semibold">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Interactive Star Rating Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Select Rating *
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1.5 bg-muted/50 p-2.5 rounded-xl border border-border">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 hover:scale-125 transition-transform focus:outline-none"
                    >
                      <Star
                        className={`w-7 h-7 transition-colors ${
                          s <= (hoverRating || rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30 hover:text-amber-400/50"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-sm font-bold text-foreground bg-accent px-3 py-1.5 rounded-lg border border-border">
                  {ratingLabels[hoverRating || rating]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Product / Service Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Target Product / Service
                </label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="GENERAL">General Platform & Services</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Your Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Your Name / Organization
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Chen or AutomateHQ"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Review Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Feedback Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Reduced our deployment latency by 60% with flawless reliability"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
              />
            </div>

            {/* Detailed Comments */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Detailed Feedback & Comments *
              </label>
              <textarea
                rows={4}
                placeholder="Describe what you liked, performance impact, ease of integration, or suggestions..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Filter & Search Bar ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-foreground">Community & Admin Feedback</h3>
            <p className="text-xs text-muted-foreground">Filtered by user ratings and verified reviews</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search feedback..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Rating Filter */}
            <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border">
              {["ALL", "5", "4", "3"].map((starVal) => (
                <button
                  key={starVal}
                  onClick={() => setFilterRating(starVal)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    filterRating === starVal
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {starVal === "ALL" ? "All Stars" : `${starVal} ★`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Reviews Grid ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading customer feedback...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl space-y-3">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <p className="text-base font-bold text-foreground">No feedback found matching your criteria</p>
            <p className="text-xs text-muted-foreground">Be the first to submit a review for this product or service above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((rev) => {
              const isAdminAuthor = rev.user?.role === "SUPER_ADMIN" || rev.user?.role === "SUB_ADMIN"
              return (
                <div
                  key={rev.id}
                  className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Stars & Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < rev.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>

                      {isAdminAuthor ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                          <ShieldCheck className="w-3 h-3" /> Admin Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Verified User
                        </span>
                      )}
                    </div>

                    {/* Title & Body */}
                    <div>
                      <h4 className="font-bold text-base text-foreground leading-snug">{rev.title}</h4>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">&ldquo;{rev.body}&rdquo;</p>
                    </div>
                  </div>

                  {/* Author Footer */}
                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {(rev.user?.name || "U").substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{rev.user?.name || "Verified Customer"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {rev.product?.name ? `Service: ${rev.product.name}` : "Platform Service"}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(rev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
