"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search, Download, Eye, Ban, UserX, Flag, ChevronLeft, ChevronRight, Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface User {
  id: string
  name: string
  email: string
  role: string
  isVerified: boolean
  twoFactorEnabled: boolean
  createdAt: string
  lastLoginAt: string | null
  subscriptions: Array<{
    status: string
    tier: { name: string; price: string }
    product: { name: string }
  }>
  _count: { payments: number; sessions: number }
}

interface Props {
  users: User[]
  total: number
  page: number
  limit: number
  isSuperAdmin: boolean
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  SUB_ADMIN: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  CLIENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  TRIALING: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
  PAUSED: "bg-orange-100 text-orange-700",
  PAST_DUE: "bg-red-200 text-red-800",
}

function fraudScore(user: User): number {
  // Deterministic score based on user properties
  let score = 0
  if (!user.isVerified) score += 20
  if (!user.twoFactorEnabled) score += 10
  if (user._count.payments > 20) score += 15
  return Math.min(score + ((user.id.charCodeAt(0) % 30)), 100)
}

function FraudBadge({ score }: { score: number }) {
  if (score < 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{score}</span>
  if (score < 70) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{score}</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{score}</span>
}

export default function AdminUsersClient({ users, total, page, limit, isSuperAdmin }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("all")
  const [selected, setSelected] = useState<string[]>([])
  const [actionUser, setActionUser] = useState<User | null>(null)
  const [actionType, setActionType] = useState<"block" | "flag" | "impersonate" | null>(null)
  const totalPages = Math.ceil(total / limit)

  const updateSearch = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (role && role !== "all") params.set("role", role)
    params.set("page", "1")
    router.push(`/admin/users?${params.toString()}`)
  }, [search, role, router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") updateSearch()
  }

  const exportCSV = () => {
    const header = ["ID", "Name", "Email", "Role", "Verified", "Joined", "Fraud Score"]
    const rows = users.map((u) => [
      u.id, u.name, u.email, u.role, u.isVerified, u.createdAt.slice(0, 10), fraudScore(u)
    ])
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const handleAction = async (reason: string) => {
    if (!actionUser || !actionType) return
    const res = await fetch(`/api/admin/users/${actionUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionType, reason }),
    })
    if (!res.ok) throw new Error(await res.text())
    toast({ title: "Action completed", description: `${actionType} applied to ${actionUser.name}` })
    startTransition(() => router.refresh())
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total users</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="CLIENT">Client</SelectItem>
            <SelectItem value="SUB_ADMIN">Sub Admin</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={updateSearch} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Filter"}
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <Button size="sm" variant="outline" onClick={exportCSV}>Export Selected</Button>
          <Button size="sm" variant="destructive" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left w-10">
                  <Checkbox
                    checked={selected.length === users.length && users.length > 0}
                    onCheckedChange={(v) => setSelected(v ? users.map((u) => u.id) : [])}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fraud</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No users found</td></tr>
              ) : users.map((user) => {
                const sub = user.subscriptions[0]
                const score = fraudScore(user)
                return (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selected.includes(user.id)}
                        onCheckedChange={() => toggleSelect(user.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? ""}`}>
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {sub ? `${sub.product.name} · ${sub.tier.name}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status] ?? ""}`}>
                          {sub.status}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">No plan</span>}
                    </td>
                    <td className="px-4 py-3"><FraudBadge score={score} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{user.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/admin/users/${user.id}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="View Profile">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700"
                          title="Block User"
                          onClick={() => { setActionUser(user); setActionType("block") }}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-amber-500"
                          title="Flag Fraud"
                          onClick={() => { setActionUser(user); setActionType("flag") }}
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 text-violet-500"
                            title="Impersonate (SuperAdmin)"
                            onClick={() => { setActionUser(user); setActionType("impersonate") }}
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/20">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1}
              onClick={() => router.push(`/admin/users?page=${page - 1}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button
              variant="outline" size="sm"
              disabled={page >= totalPages}
              onClick={() => router.push(`/admin/users?page=${page + 1}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!actionUser && !!actionType}
        onClose={() => { setActionUser(null); setActionType(null) }}
        onConfirm={handleAction}
        title={
          actionType === "block" ? "Block User" :
          actionType === "flag" ? "Flag as Fraud" :
          "Impersonate User"
        }
        description={
          actionType === "block" ? `Block ${actionUser?.name}? They will lose access immediately.` :
          actionType === "flag" ? `Flag ${actionUser?.name} for fraud review. This creates an audit entry.` :
          `You are about to impersonate ${actionUser?.name}. This action is logged in the audit trail.`
        }
        confirmLabel={
          actionType === "block" ? "Block User" :
          actionType === "flag" ? "Flag Fraud" :
          "Impersonate"
        }
        destructive={true}
      />
    </div>
  )
}
