import { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Dark Sidebar */}
      <aside className="w-64 border-r bg-zinc-950 text-zinc-300 hidden md:flex flex-col shrink-0">
        <div className="p-6 border-b border-zinc-800">
          <Link href="/admin" className="text-xl font-extrabold text-white">OpenClaude Admin</Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-red-500/50">Superadmin</span>
          </div>
        </div>
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {[
            { name: "Overview", path: "/admin", icon: "📊" },
            { name: "Users", path: "/admin/users", icon: "👥" },
            { name: "Products", path: "/admin/products", icon: "📦" },
            { name: "CRM", path: "/admin/crm", icon: "🤝" },
            { name: "Audit Logs", path: "/admin/audit", icon: "📝" },
          ].map(item => (
            <Link 
              key={item.path} 
              href={item.path} 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <span>{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-800 space-y-2">
          <div className="p-3 bg-zinc-900 rounded-lg space-y-3">
            <p className="text-xs font-medium text-zinc-400">Impersonation Mode</p>
            <select className="w-full bg-black border border-zinc-800 text-sm p-1.5 rounded text-white focus:outline-none focus:border-zinc-600">
              <option value="">Select a user...</option>
              <option value="user_1">Acme Corp (ID: 102)</option>
              <option value="user_2">Jane Doe (ID: 459)</option>
            </select>
            <Button size="sm" variant="secondary" className="w-full text-xs h-7 bg-white text-black hover:bg-zinc-200">
              View as Client
            </Button>
          </div>
          <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors">
            <span>🔙</span> Exit Admin
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/10">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-4 sm:px-6 bg-background shrink-0">
          <div className="flex items-center md:hidden gap-2">
            <span className="font-bold">Admin</span>
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Superadmin</span>
          </div>
          <div className="flex-1"></div> {/* Spacer */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              🔔
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>
            <div className="flex items-center gap-2 cursor-pointer p-1 pr-2 rounded-full hover:bg-muted transition-colors border">
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">
                SA
              </div>
              <span className="text-sm font-medium hidden sm:inline-block">System Admin</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden border-t bg-background flex justify-around p-2 pb-safe shrink-0 text-xl">
          <Link href="/admin" className="p-2">📊</Link>
          <Link href="/admin/users" className="p-2 text-muted-foreground">👥</Link>
          <Link href="/admin/products" className="p-2 text-muted-foreground">📦</Link>
          <Link href="/admin/crm" className="p-2 text-muted-foreground">🤝</Link>
          <Link href="/admin/audit" className="p-2 text-muted-foreground">📝</Link>
        </nav>
      </div>
    </div>
  )
}
