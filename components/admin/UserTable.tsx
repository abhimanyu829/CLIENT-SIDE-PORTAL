"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface UserRow {
  id: string
  name: string | null
  email: string
  role: string
  avatarUrl: string | null
  createdAt: string | Date
  subscription?: { status: string; tier: { name: string } | null } | null
}

interface UserTableProps {
  users: UserRow[]
  onRoleChange?: (userId: string, role: string) => Promise<void>
  onDelete?: (userId: string) => Promise<void>
}

const roleBadge: Record<string, string> = {
  ADMIN: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  CLIENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  STAFF: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const subBadge: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  TRIALING: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-zinc-100 text-zinc-600",
  CANCELLED: "bg-rose-100 text-rose-700",
}

export function UserTable({ users, onRoleChange, onDelete }: UserTableProps) {
  const [search, setSearch] = useState("")
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filtered = users.filter(
    (u) =>
      (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleRoleChange = async (userId: string, role: string) => {
    setLoadingId(userId)
    try {
      await onRoleChange?.(userId, role)
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async (userId: string) => {
    setLoadingId(userId)
    try {
      await onDelete?.(userId)
      setDeleteConfirm(null)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-sm"
      />

      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Subscription</th>
              <th className="p-3 font-medium">Joined</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((user) => (
              <tr
                key={user.id}
                className={`hover:bg-muted/10 transition-colors ${loadingId === user.id ? "opacity-50" : ""}`}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (user.name ?? user.email).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer focus:outline-none ${roleBadge[user.role] ?? "bg-zinc-100 text-zinc-700"}`}
                    disabled={!!loadingId}
                  >
                    <option value="CLIENT">CLIENT</option>
                    <option value="STAFF">STAFF</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="p-3">
                  {user.subscription ? (
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${subBadge[user.subscription.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {user.subscription.status}
                      </span>
                      {user.subscription.tier && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {user.subscription.tier.name}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Free</span>
                  )}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">
                  {deleteConfirm === user.id ? (
                    <span className="flex items-center justify-end gap-2">
                      <span className="text-xs text-rose-600 font-medium">Confirm?</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 h-7 px-2"
                        onClick={() => handleDelete(user.id)}
                      >
                        Yes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        No
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-500 h-7"
                      onClick={() => setDeleteConfirm(user.id)}
                      disabled={!!loadingId}
                    >
                      Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
