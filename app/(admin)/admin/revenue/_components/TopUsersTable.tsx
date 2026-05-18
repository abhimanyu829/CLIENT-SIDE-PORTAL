import Image from "next/image"

interface TopUser {
  id?: string
  name?: string
  email?: string
  avatarUrl?: string
  totalSpend: number
}

export function TopUsersTable({ users }: { users: TopUser[] }) {
  if (!users || users.length === 0) {
    return <p className="text-sm text-white/30">No payment data available yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left text-xs font-semibold uppercase tracking-widest text-white/30">
            <th className="pb-3 pr-4">#</th>
            <th className="pb-3 pr-4">User</th>
            <th className="pb-3 pr-4">Email</th>
            <th className="pb-3 text-right">Total Spend</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr
              key={user.id ?? index}
              className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
            >
              <td className="py-3 pr-4 text-white/30">{index + 1}</td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.name ?? "User"}
                      width={32}
                      height={32}
                      className="rounded-full object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400 ring-1 ring-indigo-500/30">
                      {(user.name ?? "U")[0].toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-white/80">{user.name ?? "—"}</span>
                </div>
              </td>
              <td className="py-3 pr-4 text-white/40">{user.email ?? "—"}</td>
              <td className="py-3 text-right font-semibold text-emerald-400">
                ₹{Number(user.totalSpend).toLocaleString("en-IN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
