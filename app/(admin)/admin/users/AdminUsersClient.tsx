"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  createdAt: Date
  subscriptions: { tier: { name: string } }[]
}

export default function AdminUsersClient({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [search, setSearch] = useState("")

  const filteredUsers = initialUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage users, roles, and platform access.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">Export CSV</Button>
          <Button>Invite User</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-background p-4 border rounded-xl shadow-sm">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search users by name or email..."
            className="w-full pl-4 pr-4 py-2 border rounded-lg bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select className="border rounded-lg px-3 py-2 text-sm bg-background">
            <option>All Roles</option>
            <option>ADMIN</option>
            <option>CLIENT</option>
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm bg-background">
            <option>All Plans</option>
            <option>Enterprise</option>
            <option>Pro</option>
            <option>Hobby</option>
            <option>Free</option>
          </select>
        </div>
        <Button variant="destructive" size="sm">Suspend</Button>
      </div>

      {/* Users Table */}
      <div className="bg-background border rounded-xl shadow-sm flex-1 overflow-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0 backdrop-blur-sm z-10">
            <tr>
              <th className="p-4 w-12"><input type="checkbox" className="rounded" /></th>
              <th className="p-4 font-medium">User</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Plan</th>
              <th className="p-4 font-medium">Joined</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-muted/10 transition-colors">
                <td className="p-4"><input type="checkbox" className="rounded" /></td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                      {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                    user.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 font-medium">{user.subscriptions[0]?.tier?.name ?? "Free"}</td>
                <td className="p-4 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(user)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-blue-600">Impersonate</Button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No users found matching &quot;{search}&quot;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-muted-foreground">Showing {filteredUsers.length} of {initialUsers.length} users</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">1</Button>
          <Button variant="outline" size="sm">Next</Button>
        </div>
      </div>

      {/* Slide-over User Detail Modal */}
      {selectedUser && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedUser(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background shadow-2xl z-50 border-l animate-in slide-in-from-right flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-muted/10">
              <h2 className="text-lg font-bold">Edit User</h2>
              <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
                  {selectedUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm bg-background" defaultValue={selectedUser.role}>
                    <option value="CLIENT">Client</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
              <div className="pt-6 border-t space-y-4">
                <h4 className="font-bold text-sm">Danger Zone</h4>
                <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm text-red-800 dark:text-red-300">Force Logout</p>
                      <p className="text-xs text-red-600/80">Revoke all active sessions</p>
                    </div>
                    <Button variant="outline" size="sm" className="border-red-200 text-red-700">Revoke</Button>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-red-200">
                    <div>
                      <p className="font-medium text-sm text-red-800 dark:text-red-300">Delete User</p>
                      <p className="text-xs text-red-600/80">Permanent removal</p>
                    </div>
                    <Button variant="destructive" size="sm">Delete</Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t bg-muted/10 flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
              <Button onClick={() => setSelectedUser(null)}>Save Changes</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
