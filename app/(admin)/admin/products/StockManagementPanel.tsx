"use client"

import { useState, useCallback, useTransition } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Package, Plus, Minus, RefreshCw, Eye, EyeOff,
  AlertTriangle, TrendingDown, TrendingUp, History,
  Check, X, RotateCcw, ShoppingBag, ToggleLeft, ToggleRight,
  Zap, Lock, Unlock, Edit, MessageSquare
} from "lucide-react"
import {
  getProductStock, updateStock, initProductStock,
  type StockMutationAction
} from "./actions"

// ─── Types ────────────────────────────────────────────────────────────────────

type StockRecord = {
  id: string
  productId: string
  totalStock: number
  availableStock: number
  reservedStock: number
  soldStock: number
  lowStockThreshold: number
  isOutOfStock: boolean
  restockQty: number
  stockVisible: boolean
  backOrdersEnabled: boolean
  autoDisableOnZero: boolean
  autoEnableOnRestock: boolean
  warningMessage: string | null
  createdAt: string
  updatedAt: string
  history: StockHistoryEntry[]
}

type StockHistoryEntry = {
  id: string
  action: string
  field: string
  previousValue: number
  updatedValue: number
  reason: string | null
  adminEmail: string | null
  orderId: string | null
  createdAt: string
}

interface Props {
  productId: string
  productName: string
  initialStock: StockRecord | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StockBadge({ value, threshold, outOfStock }: {
  value: number; threshold: number; outOfStock: boolean
}) {
  if (outOfStock) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-900/40 px-2.5 py-0.5 text-xs font-semibold text-red-300">
        <X className="h-3 w-3" /> Out of Stock
      </span>
    )
  }
  if (value <= threshold) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
        <AlertTriangle className="h-3 w-3" /> Low Stock · {value}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
      <Check className="h-3 w-3" /> In Stock · {value}
    </span>
  )
}

const ACTION_LABELS: Record<string, string> = {
  INCREASE: "Increased",
  DECREASE: "Decreased",
  RESET: "Reset",
  RESTOCK: "Restocked",
  MARK_OUT: "Marked Out",
  MARK_IN: "Marked In",
  EDIT: "Edited",
  SET_TOTAL: "Set Total",
  TOGGLE_VISIBILITY: "Visibility Changed",
  TOGGLE_BACKORDERS: "Back-orders Toggled",
  SET_THRESHOLD: "Threshold Set",
  SET_WARNING: "Warning Updated",
  SET_RESTOCK_QTY: "Restock Qty Set",
  INIT: "Initialised",
  PURCHASE_DEDUCT: "Purchase Deducted",
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StockManagementPanel({ productId, productName, initialStock }: Props) {
  const { toast } = useToast()
  const [stock, setStock] = useState<StockRecord | null>(initialStock)
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"overview" | "controls" | "history">("overview")

  // Form state
  const [qtyInput, setQtyInput] = useState("")
  const [reasonInput, setReasonInput] = useState("")
  const [warningInput, setWarningInput] = useState(stock?.warningMessage ?? "")
  const [thresholdInput, setThresholdInput] = useState(String(stock?.lowStockThreshold ?? 5))
  const [restockQtyInput, setRestockQtyInput] = useState(String(stock?.restockQty ?? 0))
  const [editAvailInput, setEditAvailInput] = useState(String(stock?.availableStock ?? 0))
  const [totalInput, setTotalInput] = useState(String(stock?.totalStock ?? 0))
  const [showHistoryAll, setShowHistoryAll] = useState(false)

  // Refresh from server
  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const s = await getProductStock(productId)
        if (s) setStock(s as any)
      } catch {
        toast({ title: "Failed to refresh stock", variant: "destructive" })
      }
    })
  }, [productId, toast])

  // Core mutation
  const mutate = useCallback(
    (action: StockMutationAction, opts: { qty?: number; value?: any; reason?: string } = {}) => {
      startTransition(async () => {
        try {
          const updated = await updateStock(productId, action, opts)
          const fresh = await getProductStock(productId)
          if (fresh) setStock(fresh as any)
          toast({
            title: ACTION_LABELS[action] ?? action,
            description: `Stock updated successfully`,
          })
        } catch (err: any) {
          toast({
            title: "Stock update failed",
            description: err?.message ?? "Unknown error",
            variant: "destructive",
          })
        }
      })
    },
    [productId, toast]
  )

  // Init if no record
  const handleInit = useCallback(() => {
    startTransition(async () => {
      try {
        const s = await initProductStock(productId, {
          totalStock: 0,
          availableStock: 0,
          lowStockThreshold: 5,
          stockVisible: true,
        })
        setStock(s as any)
        toast({ title: "Stock tracking enabled", description: productName })
      } catch (err: any) {
        toast({ title: "Failed to enable stock", description: err?.message, variant: "destructive" })
      }
    })
  }, [productId, productName, toast])

  // ── Not initialised state ──────────────────────────────────────────────────
  if (!stock) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
        <Package className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="mt-3 text-sm font-semibold text-zinc-400">Stock tracking not enabled</p>
        <p className="mt-1 text-xs text-zinc-600">
          Enable to manage inventory, track sales, and show live stock on marketplace.
        </p>
        <button
          onClick={handleInit}
          disabled={isPending}
          className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Enabling…" : "Enable Stock Tracking"}
        </button>
      </div>
    )
  }

  const history = stock.history ?? []
  const historyToShow = showHistoryAll ? history : history.slice(0, 10)

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-zinc-200">Inventory</span>
          <StockBadge
            value={stock.availableStock}
            threshold={stock.lowStockThreshold}
            outOfStock={stock.isOutOfStock}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={isPending}
            title="Refresh"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          </button>
          {/* Tab buttons */}
          {(["overview", "controls", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                activeTab === t
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "history" ? <span className="flex items-center gap-1"><History className="h-3 w-3" />{t}</span> : t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview ── */}
      {activeTab === "overview" && (
        <div className="p-5 space-y-4">
          {/* Stock counters */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Stock", value: stock.totalStock, color: "text-zinc-200" },
              { label: "Available", value: stock.availableStock, color: "text-emerald-300" },
              { label: "Reserved", value: stock.reservedStock, color: "text-amber-300" },
              { label: "Sold", value: stock.soldStock, color: "text-violet-300" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-center">
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="mt-1 text-xs text-zinc-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Settings pills */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
              stock.stockVisible ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-300" : "border-zinc-700 text-zinc-500"
            }`}>
              {stock.stockVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Stock {stock.stockVisible ? "Visible" : "Hidden"}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
              stock.backOrdersEnabled ? "border-blue-700/50 bg-blue-900/20 text-blue-300" : "border-zinc-700 text-zinc-500"
            }`}>
              {stock.backOrdersEnabled ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              Back-orders {stock.backOrdersEnabled ? "Enabled" : "Disabled"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              Low Stock Threshold: {stock.lowStockThreshold}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              <Package className="h-3 w-3 text-violet-400" />
              Restock Qty: {stock.restockQty}
            </span>
          </div>

          {/* Warning message */}
          {stock.warningMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-700/40 bg-amber-900/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-sm text-amber-300">{stock.warningMessage}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Controls ── */}
      {activeTab === "controls" && (
        <div className="p-5 space-y-5">
          {/* Quick actions row */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => mutate("MARK_OUT", { reason: "Admin marked out of stock" })}
              disabled={isPending}
              className="rounded-lg border border-red-700/40 bg-red-900/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/30 disabled:opacity-50 transition-colors"
            >
              <X className="inline h-3 w-3 mr-1" />Mark Out of Stock
            </button>
            <button
              onClick={() => mutate("MARK_IN", { reason: "Admin marked in stock" })}
              disabled={isPending}
              className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50 transition-colors"
            >
              <Check className="inline h-3 w-3 mr-1" />Mark In Stock
            </button>
            <button
              onClick={() => mutate("TOGGLE_VISIBILITY")}
              disabled={isPending}
              className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {stock.stockVisible ? <EyeOff className="inline h-3 w-3 mr-1" /> : <Eye className="inline h-3 w-3 mr-1" />}
              {stock.stockVisible ? "Hide" : "Show"} Stock Counter
            </button>
            <button
              onClick={() => mutate("TOGGLE_BACKORDERS")}
              disabled={isPending}
              className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {stock.backOrdersEnabled ? <Lock className="inline h-3 w-3 mr-1" /> : <Unlock className="inline h-3 w-3 mr-1" />}
              {stock.backOrdersEnabled ? "Disable" : "Enable"} Back-orders
            </button>
            <button
              onClick={() => mutate("RESET", { reason: "Admin reset stock" })}
              disabled={isPending}
              className="rounded-lg border border-orange-700/40 bg-orange-900/10 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-900/30 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="inline h-3 w-3 mr-1" />Reset to 0
            </button>
          </div>

          <hr className="border-zinc-800" />

          {/* Increase / Decrease */}
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-400">Adjust Available Stock</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                placeholder="Quantity"
                className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
              />
              <input
                type="text"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="Reason (optional)"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  const n = parseInt(qtyInput)
                  if (!n || n <= 0) return
                  mutate("INCREASE", { qty: n, reason: reasonInput || undefined })
                  setQtyInput(""); setReasonInput("")
                }}
                disabled={isPending || !qtyInput}
                className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" />Add
              </button>
              <button
                onClick={() => {
                  const n = parseInt(qtyInput)
                  if (!n || n <= 0) return
                  mutate("DECREASE", { qty: n, reason: reasonInput || undefined })
                  setQtyInput(""); setReasonInput("")
                }}
                disabled={isPending || !qtyInput}
                className="flex items-center gap-1 rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <Minus className="h-4 w-4" />Remove
              </button>
            </div>
          </div>

          {/* Restock */}
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-400">
              Restock (preset qty: <span className="text-violet-300">{stock.restockQty}</span>)
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={restockQtyInput}
                onChange={(e) => setRestockQtyInput(e.target.value)}
                placeholder={String(stock.restockQty)}
                className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  const n = parseInt(restockQtyInput) || stock.restockQty
                  mutate("RESTOCK", { qty: n, reason: "Restock" })
                }}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
              >
                <Zap className="h-4 w-4" />Restock
              </button>
              <button
                onClick={() => {
                  const n = parseInt(restockQtyInput)
                  if (!n || n <= 0) return
                  mutate("SET_RESTOCK_QTY", { value: n })
                  setRestockQtyInput(String(n))
                }}
                disabled={isPending}
                className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                Save Qty
              </button>
            </div>
          </div>

          {/* Direct edit */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-zinc-400">Set Available Stock Directly</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={editAvailInput}
                  onChange={(e) => setEditAvailInput(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
                <button
                  onClick={() => {
                    const n = parseInt(editAvailInput)
                    if (isNaN(n)) return
                    mutate("EDIT", { value: n, reason: "Direct edit" })
                  }}
                  disabled={isPending}
                  className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-zinc-400">Set Total Stock</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
                <button
                  onClick={() => {
                    const n = parseInt(totalInput)
                    if (isNaN(n)) return
                    mutate("SET_TOTAL", { value: n, reason: "Total edit" })
                  }}
                  disabled={isPending}
                  className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Low stock threshold */}
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-400">Low Stock Threshold</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  const n = parseInt(thresholdInput)
                  if (isNaN(n) || n < 0) return
                  mutate("SET_THRESHOLD", { value: n })
                }}
                disabled={isPending}
                className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                Set
              </button>
            </div>
          </div>

          {/* Warning message */}
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-400">
              <MessageSquare className="inline h-3 w-3 mr-1 text-zinc-500" />
              Warning Message (shown on marketplace)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={warningInput}
                onChange={(e) => setWarningInput(e.target.value)}
                placeholder="e.g. Limited slots available this month"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={() => mutate("SET_WARNING", { value: warningInput || null })}
                disabled={isPending}
                className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors"
              >
                Save
              </button>
              {stock.warningMessage && (
                <button
                  onClick={() => { mutate("SET_WARNING", { value: null }); setWarningInput("") }}
                  disabled={isPending}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Auto-management toggles */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => mutate("TOGGLE_AUTO_DISABLE")}
              disabled={isPending}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                stock.autoDisableOnZero
                  ? "border-violet-700/50 bg-violet-900/20 text-violet-300"
                  : "border-zinc-700 text-zinc-500"
              }`}
            >
              {stock.autoDisableOnZero ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              Auto-disable at 0
            </button>
            <button
              onClick={() => mutate("TOGGLE_AUTO_ENABLE")}
              disabled={isPending}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                stock.autoEnableOnRestock
                  ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-300"
                  : "border-zinc-700 text-zinc-500"
              }`}
            >
              {stock.autoEnableOnRestock ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              Auto-enable on restock
            </button>
          </div>
        </div>
      )}

      {/* ── History ── */}
      {activeTab === "history" && (
        <div className="p-5">
          {history.length === 0 ? (
            <p className="text-center text-sm text-zinc-600 py-6">No history yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/50">
                      {["Action", "Field", "Before", "After", "Admin", "Reason", "Date"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyToShow.map((h, i) => (
                      <tr key={h.id} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-900/20"}`}>
                        <td className="px-3 py-2">
                          <span className={`font-semibold ${
                            h.action === "PURCHASE_DEDUCT" ? "text-violet-300"
                            : h.action.includes("RESTOCK") || h.action === "INCREASE" || h.action === "MARK_IN" ? "text-emerald-300"
                            : h.action === "RESET" || h.action === "MARK_OUT" ? "text-red-300"
                            : "text-zinc-300"
                          }`}>
                            {ACTION_LABELS[h.action] ?? h.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-500 font-mono">{h.field}</td>
                        <td className="px-3 py-2 text-zinc-400">{h.previousValue}</td>
                        <td className="px-3 py-2 font-semibold">
                          {h.updatedValue > h.previousValue ? (
                            <span className="text-emerald-300 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />{h.updatedValue}</span>
                          ) : h.updatedValue < h.previousValue ? (
                            <span className="text-red-300 flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />{h.updatedValue}</span>
                          ) : (
                            <span className="text-zinc-400">{h.updatedValue}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-zinc-500">{h.adminEmail?.split("@")[0] ?? "system"}</td>
                        <td className="px-3 py-2 text-zinc-600 max-w-[140px] truncate">{h.reason ?? "—"}</td>
                        <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {history.length > 10 && (
                <button
                  onClick={() => setShowHistoryAll((p) => !p)}
                  className="mt-3 text-xs text-violet-400 hover:text-violet-300"
                >
                  {showHistoryAll ? "Show less" : `Show all ${history.length} entries`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
