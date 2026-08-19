"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck, LayoutDashboard, Home } from "lucide-react"

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-16 min-h-screen bg-gray-950 border-r border-gray-800 text-gray-200 items-center py-4 gap-4">
      {/* Logo icon */}
      <Link href="/admin" className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all">
        <ShieldCheck className="w-5 h-5 text-primary" />
      </Link>

      <div className="flex-1" />

      {/* Back to home */}
      <Link
        href="/"
        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
        title="Back to Site"
      >
        <Home className="w-4 h-4 text-gray-400" />
      </Link>
    </aside>
  )
}
