import { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col shrink-0">
        <div className="p-6 border-b">
          <Link href="/dashboard" className="text-xl font-extrabold text-primary">OpenClaude</Link>
          <div className="text-xs text-muted-foreground mt-1">Client Portal</div>
        </div>
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {[
            { name: "Overview", path: "/dashboard", icon: "📊" },
            { name: "Subscriptions", path: "/dashboard/subscriptions", icon: "💳" },
            { name: "Projects", path: "/dashboard/projects", icon: "📁" },
            { name: "Invoices", path: "/dashboard/invoices", icon: "📄" },
            { name: "Support Tickets", path: "/dashboard/tickets", icon: "🎫" },
            { name: "Live Chat", path: "/dashboard/chat", icon: "💬" },
          ].map(item => (
            <Link 
              key={item.path} 
              href={item.path} 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <span>{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t space-y-2">
          <Link href="/dashboard/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <span>⚙️</span> Settings
          </Link>
          <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <span>🔙</span> Back to Site
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-4 sm:px-6 bg-background shrink-0">
          <div className="flex items-center md:hidden">
            <span className="font-bold text-primary">OpenClaude</span>
          </div>
          <div className="flex-1"></div> {/* Spacer */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              🔔
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>
            <div className="flex items-center gap-2 cursor-pointer p-1 pr-2 rounded-full hover:bg-muted transition-colors border">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                AB
              </div>
              <span className="text-sm font-medium hidden sm:inline-block">Acme Corp</span>
              <span className="text-xs ml-1">▼</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-muted/10 p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation (Visible only on small screens) */}
        <nav className="md:hidden border-t bg-background flex justify-around p-2 pb-safe shrink-0 text-2xl">
          <Link href="/dashboard" className="p-2 text-primary">📊</Link>
          <Link href="/dashboard/subscriptions" className="p-2 text-muted-foreground">💳</Link>
          <Link href="/dashboard/projects" className="p-2 text-muted-foreground">📁</Link>
          <Link href="/dashboard/chat" className="p-2 text-muted-foreground">💬</Link>
          <Link href="/dashboard/profile" className="p-2 text-muted-foreground">⚙️</Link>
        </nav>
      </div>
    </div>
  )
}
