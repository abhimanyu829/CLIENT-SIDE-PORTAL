import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, Acme Corp</h1>
          <p className="text-muted-foreground mt-1">Here is what is happening with your account today.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/marketplace">
            <Button variant="outline">Browse Marketplace</Button>
          </Link>
          <Button>New Project</Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Subscriptions", value: "3", icon: "📦" },
          { label: "Total API Calls", value: "45.2k", icon: "⚡" },
          { label: "Open Tickets", value: "1", icon: "🎫" },
          { label: "Monthly Spend", value: "$349.00", icon: "💳" },
        ].map((stat, i) => (
          <div key={i} className="p-6 border rounded-xl bg-background shadow-sm space-y-2">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (Wider) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Subscribed Products */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Your Products</h2>
              <Link href="/dashboard/subscriptions" className="text-sm text-primary hover:underline font-medium">Manage All</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: "Sales CRM AI", status: "Active", plan: "Pro Tier", usage: "65%" },
                { name: "Chatbot Template", status: "Active", plan: "Hobby Tier", usage: "90%" },
              ].map((prod, i) => (
                <div key={i} className="p-5 border rounded-xl bg-background shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{prod.name}</h3>
                      <p className="text-sm text-muted-foreground">{prod.plan}</p>
                    </div>
                    <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-1 rounded-full font-medium">{prod.status}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>API Usage</span>
                      <span>{prod.usage}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full bg-primary rounded-full`} style={{ width: prod.usage }}></div>
                    </div>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <Button size="sm" variant="outline" className="w-full">Configure</Button>
                    <Button size="sm" variant="secondary" className="w-full">Docs</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="border rounded-xl bg-background shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/20">
              <h2 className="font-bold">Recent Activity</h2>
            </div>
            <div className="divide-y">
              {[
                { title: "Invoice Paid", desc: "Invoice #INV-2024-001 for $349.00 was paid successfully.", time: "2 hours ago", icon: "💸" },
                { title: "Ticket Resolved", desc: "Support ticket #T-882 'API Rate Limit Issue' was marked as resolved.", time: "1 day ago", icon: "✅" },
                { title: "New Login", desc: "Successful login from IP 192.168.1.1 (Mac OS).", time: "2 days ago", icon: "🔐" },
              ].map((act, i) => (
                <div key={i} className="p-4 flex gap-4 hover:bg-muted/10 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-xl">
                    {act.icon}
                  </div>
                  <div className="flex-1 space-y-1 text-sm">
                    <p className="font-medium">{act.title}</p>
                    <p className="text-muted-foreground">{act.desc}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {act.time}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t text-center bg-muted/10">
              <Button variant="link" size="sm" className="text-muted-foreground">View all activity</Button>
            </div>
          </div>
        </div>

        {/* Right Column (Narrower) */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <div className="border rounded-xl bg-background shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/20">
              <h2 className="font-bold">Quick Actions</h2>
            </div>
            <div className="p-2 flex flex-col">
              <Link href="/dashboard/tickets/new" className="px-4 py-3 text-sm font-medium hover:bg-muted rounded-lg transition-colors flex items-center justify-between">
                <span>Create Support Ticket</span>
                <span className="text-muted-foreground">→</span>
              </Link>
              <Link href="/dashboard/invoices" className="px-4 py-3 text-sm font-medium hover:bg-muted rounded-lg transition-colors flex items-center justify-between">
                <span>Download Latest Invoice</span>
                <span className="text-muted-foreground">→</span>
              </Link>
              <Link href="/dashboard/profile" className="px-4 py-3 text-sm font-medium hover:bg-muted rounded-lg transition-colors flex items-center justify-between">
                <span>Update Payment Method</span>
                <span className="text-muted-foreground">→</span>
              </Link>
              <Link href="/dashboard/chat" className="px-4 py-3 text-sm font-medium hover:bg-muted rounded-lg transition-colors flex items-center justify-between">
                <span>Talk to AI Assistant</span>
                <span className="text-muted-foreground">→</span>
              </Link>
            </div>
          </div>

          {/* Need Help CTA */}
          <div className="border rounded-xl bg-primary/5 shadow-sm p-6 space-y-4 border-primary/20">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-2xl">
              👩‍💻
            </div>
            <div>
              <h3 className="font-bold">Need assistance?</h3>
              <p className="text-sm text-muted-foreground mt-1">Our enterprise support team is available 24/7 to help you with integration.</p>
            </div>
            <Button className="w-full">Contact Support</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
