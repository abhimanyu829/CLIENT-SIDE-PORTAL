"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useCallback, useRef } from "react"
import { SignOutButton, UserAvatar, useClerk, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard, Users, CreditCard, ShoppingCart, Package,
  Tag, BarChart3, Bot, ShieldCheck, Settings, LogOut,
  ChevronLeft, ChevronRight, Menu, Bell, Sun, Moon, User,
  ExternalLink, Webhook, Store, ScanSearch, Eye, WalletCards, Briefcase, KeyRound, Megaphone, ClipboardList, Crown
} from "lucide-react"
import { Toaster } from "@/components/ui/toaster"
import RealtimeAdminProvider from "@/components/admin/RealtimeAdminProvider"
import type { SubadminPermission, SubadminResource } from "@/lib/subadmin-permission-policy"

type NavigationItem = {
  name: string
  path: string
  icon: any
  resource?: SubadminResource
  superAdminOnly?: boolean
}

const NAV_ITEMS: NavigationItem[] = [
  { name: "Deployment Center", path: "/admin/deployment-center", icon: Briefcase, resource: "Services" },
  { name: "Revenue Dashboard",   path: "/admin",             icon: LayoutDashboard, resource: "Analytics" },
  { name: "Ecosystem Control",   path: "/admin/ecosystem",   icon: Store, resource: "Marketing" },
  { name: "User Management",     path: "/admin/users",       icon: Users, resource: "Users" },
  { name: "Subadmin Management", path: "/admin/subadmins",   icon: ShieldCheck, superAdminOnly: true },
  { name: "Subscriptions",       path: "/admin/subscriptions", icon: CreditCard, resource: "Orders" },
  { name: "Billing Center",      path: "/admin/billing-center", icon: Crown, superAdminOnly: true },
  { name: "Orders & Payments",  path: "/admin/orders",      icon: ShoppingCart, resource: "Orders" },
  { name: "Payment Inspection",  path: "/admin/payments",    icon: ScanSearch, resource: "Payments" },
  { name: "Manual Verifications", path: "/admin/payments/verifications", icon: WalletCards, superAdminOnly: true },
  { name: "Products & Plans",   path: "/admin/products",    icon: Package, resource: "Products" },
  { name: "Product Services",   path: "/admin/products/service-management", icon: Settings, resource: "Products" },
  { name: "Service Offerings",  path: "/admin/services",    icon: Briefcase, resource: "Services" },
  { name: "Service Requests",   path: "/admin/service-requests", icon: ClipboardList, resource: "Services" },
  { name: "Service Campaigns",  path: "/admin/service-campaigns", icon: Megaphone, resource: "Marketing" },
  { name: "Preview Center",    path: "/admin/previews",     icon: Eye, resource: "Media" },
  { name: "Credential Requests", path: "/admin/credential-requests", icon: KeyRound, resource: "Users" },
  { name: "Offers & Coupons",   path: "/admin/coupons",     icon: Tag, resource: "Marketing" },
  { name: "Email Center",       path: "/admin/emails",      icon: Settings, resource: "Email Center" },
  { name: "Analytics",           path: "/admin/analytics",   icon: BarChart3, resource: "Analytics" },
  { name: "AI Monitoring",       path: "/admin/ai-monitoring", icon: Bot, resource: "Analytics" },
  { name: "Webhooks & Events",  path: "/admin/webhooks",    icon: Webhook },
  { name: "Security & Audit",   path: "/admin/audit",       icon: ShieldCheck, superAdminOnly: true },
  { name: "Platform Settings",   path: "/admin/settings",    icon: Settings },
]

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

function isNavigationAllowed(
  item: NavigationItem,
  isSuperAdmin: boolean | undefined,
  permissions: SubadminPermission[]
) {
  if (isSuperAdmin) return true
  if (item.superAdminOnly || !item.resource) return false
  return permissions.some((permission) => permission.resource === item.resource && permission.action === "VIEW")
}

interface AdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
  onSignOut: (url?: string) => void
  isSuperAdmin?: boolean
  allowedPermissions?: SubadminPermission[]
  userName?: string
  userEmail?: string
}

function AdminSidebar({ collapsed, onToggle, onSignOut, isSuperAdmin, allowedPermissions = [], userName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname()
  const { signOut: clerkSignOut } = useClerk()

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full border-r bg-zinc-950 text-zinc-300 transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center border-b border-zinc-800 h-16 px-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div>
            <Link href="/admin" className="text-lg font-extrabold text-white tracking-tight">
              AbhiBhi Admin
            </Link>
            <div className="mt-0.5">
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border",
                isSuperAdmin
                  ? "bg-red-500/20 text-red-400 border-red-500/50"
                  : "bg-amber-500/20 text-amber-400 border-amber-500/50"
              )}>
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="text-zinc-500 hover:text-white transition-colors p-1 rounded"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
        {NAV_ITEMS.filter((item) => isNavigationAllowed(item, isSuperAdmin, allowedPermissions)).map((item) => {
          const isActive = item.path === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.path)
          return (
            <Link
              key={item.path}
              href={item.path}
              title={collapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-white/10 text-white font-medium"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.name}</span>}
              {!collapsed && isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="shrink-0">
              <UserAvatar />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{userName}</p>
              <p className="text-[10px] text-zinc-500 truncate">{userEmail}</p>
            </div>
          </div>
        )}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "View Site" : undefined}
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          {!collapsed && "View Site"}
        </Link>
        <button
          onClick={() => onSignOut("/login")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-red-900/30 hover:text-red-400 transition-colors",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </aside>
  )
}

interface AdminLayoutClientProps {
  children: React.ReactNode
  isSuperAdmin?: boolean
  allowedPermissions?: SubadminPermission[]
  userName?: string
  userEmail?: string
}

export function AdminLayoutClient({ children, isSuperAdmin, allowedPermissions = [], userName, userEmail }: AdminLayoutClientProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { signOut: clerkSignOut } = useClerk()
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { user: clerkUser } = useUser()

  const handleSignOut = useCallback(async (callbackUrl = "/login") => {
    try {
      await clerkSignOut({ redirectUrl: callbackUrl })
    } catch {
      // Clerk not applicable
    }
  }, [clerkSignOut])

  // Session timeout: 30 min inactivity
  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      handleSignOut("/login?reason=timeout")
    }, INACTIVITY_TIMEOUT_MS)
  }, [handleSignOut])

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"]
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [resetTimer])

  // Get current page name for breadcrumb
  const currentPage = NAV_ITEMS.find((item) =>
    item.path === "/admin" ? pathname === "/admin" : pathname.startsWith(item.path)
  )
  const displayName =
    clerkUser?.fullName ||
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    userName ||
    "Admin"
  const displayEmail = clerkUser?.primaryEmailAddress?.emailAddress || userEmail || ""

  return (
    <div className={cn("flex h-screen bg-background overflow-hidden", darkMode && "dark")}>
      {/* Desktop Sidebar */}
      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        onSignOut={handleSignOut}
        isSuperAdmin={isSuperAdmin}
        allowedPermissions={allowedPermissions}
        userName={displayName}
        userEmail={displayEmail}
      />

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-zinc-950 border-zinc-800">
          <SheetTitle className="sr-only">Admin Navigation Menu</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-zinc-800 h-16 px-4">
              <Link href="/admin" className="text-lg font-extrabold text-white" onClick={() => setMobileOpen(false)}>
                AbhiBhi Admin
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
              {NAV_ITEMS.filter((item) => isNavigationAllowed(item, isSuperAdmin, allowedPermissions)).map((item) => {
                const isActive = item.path === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                      isActive
                        ? "bg-white/10 text-white font-medium"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>
            <div className="border-t border-zinc-800 p-3">
              <button
                onClick={() => handleSignOut("/login")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-4 sm:px-6 bg-background shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden md:block">Admin</span>
              {currentPage && (
                <>
                  <span className="hidden md:block">/</span>
                  <span className="font-medium text-foreground">{currentPage.name}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode((v) => !v)}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </Button>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-muted transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-sm font-bold">
                    {userName?.[0]?.toUpperCase() ?? "A"}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">{userName ?? "Admin"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{displayEmail}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <SignOutButton redirectUrl="/login">
                    <button className="flex w-full items-center px-2 py-2 text-left text-red-600 focus:text-red-600">
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </button>
                  </SignOutButton>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <RealtimeAdminProvider>
            {children}
          </RealtimeAdminProvider>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
