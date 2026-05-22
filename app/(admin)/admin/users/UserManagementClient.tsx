"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function UserManagementClient({ users, total, page }: { users: any[], total: number, page: number }) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/admin/users?q=${search}`)
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage platform users, subscriptions, and roles.</p>
        </div>
        <Button variant="default">Export Users</Button>
      </div>

      <div className="flex justify-between items-center gap-4">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-sm w-full">
          <input 
            type="text" 
            placeholder="Search name or email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <div className="flex gap-2">
          <select className="border rounded-md px-3 py-1.5 text-sm bg-background">
            <option>All Plans</option>
            <option>Free</option>
            <option>Pro</option>
          </select>
        </div>
      </div>

      <div className="border rounded-xl bg-background shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const sub = user.subscriptions?.[0]
                return (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === "SUPER_ADMIN" ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-700"}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sub ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {sub.product.name} {sub.tier.name}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="ghost" size="sm">View Profile</Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center bg-muted/20">
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => router.push(`/admin/users?page=${page - 1}`)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => router.push(`/admin/users?page=${page + 1}`)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
