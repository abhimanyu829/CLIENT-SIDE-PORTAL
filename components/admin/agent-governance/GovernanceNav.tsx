"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export const GOVERNANCE_SECTIONS = [
  { href: "/admin/agent-governance", label: "Overview", exact: true },
  { href: "/admin/agent-governance/connections", label: "Connections" },
  { href: "/admin/agent-governance/capabilities", label: "Capabilities" },
  { href: "/admin/agent-governance/policies", label: "Policies" },
  { href: "/admin/agent-governance/autonomy", label: "Autonomy" },
  { href: "/admin/agent-governance/approvals", label: "Approvals" },
  { href: "/admin/agent-governance/tasks", label: "Tasks" },
  { href: "/admin/agent-governance/triggers", label: "Triggers" },
  { href: "/admin/agent-governance/schedules", label: "Schedules" },
  { href: "/admin/agent-governance/webhooks", label: "Webhooks" },
  { href: "/admin/agent-governance/runtime", label: "Runtime" },
] as const

/** Section navigation for Agent Governance; the current section carries aria-current="page". */
export function GovernanceNav() {
  const pathname = usePathname() ?? ""
  return (
    <nav aria-label="Agent governance sections">
      <ul className="flex flex-wrap gap-1 border-b pb-2">
        {GOVERNANCE_SECTIONS.map((s) => {
          const active = "exact" in s && s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`)
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-block rounded-md px-3 py-1.5 text-sm",
                  active ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {s.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
