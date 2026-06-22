"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  Ticket,
  FolderKanban,
  MessageSquare,
  Settings,
  ShieldCheck,
  FileText,
  GitBranch,
  PlaySquare,
  CreditCard,
  ShoppingCart,
  RotateCcw,
  Briefcase,
  Settings2,
  Shapes,
  ClipboardList,
  ReceiptText,
  Sparkles,
} from "lucide-react"

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/services", label: "Services", icon: Briefcase },
  { href: "/admin/services/centers", label: "Service Centers", icon: Settings2 },
  { href: "/admin/services/emails", label: "Service Emails", icon: MessageSquare },
  { href: "/admin/services/saas", label: "SaaS Center", icon: Sparkles },
  { href: "/admin/services/ai-agents", label: "AI Agents", icon: Sparkles },
  { href: "/admin/services/ai-models", label: "AI Models", icon: Sparkles },
  { href: "/admin/services/automation", label: "Automation", icon: Sparkles },
  { href: "/admin/services/websites", label: "Websites", icon: Sparkles },
  { href: "/admin/services/apis", label: "APIs", icon: Sparkles },
  { href: "/admin/services/enterprise", label: "Enterprise", icon: Sparkles },
  { href: "/admin/services/cloud", label: "Cloud", icon: Sparkles },
  { href: "/admin/services/consulting", label: "Consulting", icon: Sparkles },
  { href: "/admin/services/categories", label: "Service Categories", icon: Shapes },
  { href: "/admin/services/orders", label: "Service Orders", icon: ReceiptText },
  { href: "/admin/services/requests", label: "Service Requests", icon: ClipboardList },
  { href: "/admin/services/analytics", label: "Service Analytics", icon: BarChart3 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: GitBranch },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/previews", label: "Previews", icon: PlaySquare },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/tickets", label: "Tickets", icon: Ticket },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/leads", label: "CRM Leads", icon: MessageSquare },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/audit", label: "Audit Logs", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-gray-950 border-r border-gray-800 text-gray-200">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <span className="font-bold text-lg tracking-tight text-white">Admin Panel</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-800 text-xs text-gray-500">
        OpenClaude Admin v1.0
      </div>
    </aside>
  )
}
