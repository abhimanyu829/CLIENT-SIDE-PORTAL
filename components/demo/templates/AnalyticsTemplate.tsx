"use client"

import { Button } from "@/components/ui/button"

export default function AnalyticsTemplate() {
  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Sidebar Nav */}
      <aside className="w-64 border-r bg-muted/20 hidden md:flex flex-col">
        <div className="p-4 border-b font-bold flex items-center gap-2">
          <span className="text-primary">📊</span> Analytics AI
        </div>
        <nav className="p-4 space-y-2 flex-1">
          {["Overview", "Real-time", "Audience", "Acquisition", "Behavior"].map(item => (
            <div key={item} className={`px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${item === 'Overview' ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}>
              {item}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Top Bar / Filters */}
        <div className="p-6 border-b bg-card space-y-4 sticky top-0 z-10 shadow-sm">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Dashboard Overview</h1>
            <div className="flex items-center gap-2">
              <select className="text-sm border rounded-md p-2 bg-background font-medium">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>This Year</option>
              </select>
              <Button size="sm" variant="outline">Export CSV</Button>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium cursor-pointer">All Traffic</span>
            <span className="px-3 py-1 bg-muted text-muted-foreground border rounded-full text-xs font-medium cursor-pointer hover:bg-muted/80">Organic Search</span>
            <span className="px-3 py-1 bg-muted text-muted-foreground border rounded-full text-xs font-medium cursor-pointer hover:bg-muted/80">Social</span>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-6 space-y-6 flex-1 bg-muted/10">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: "124,592", trend: "+12.5%", positive: true },
              { label: "Sessions", value: "452,109", trend: "+8.2%", positive: true },
              { label: "Bounce Rate", value: "42.3%", trend: "-2.1%", positive: true },
              { label: "Avg. Session Duration", value: "2m 45s", trend: "-0.5%", positive: false },
            ].map((kpi, i) => (
              <div key={i} className="p-5 border rounded-xl bg-background shadow-sm space-y-2">
                <p className="text-sm text-muted-foreground font-medium">{kpi.label}</p>
                <p className="text-3xl font-bold">{kpi.value}</p>
                <p className={`text-xs font-semibold ${kpi.positive ? 'text-green-500' : 'text-red-500'}`}>
                  {kpi.trend} vs previous period
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart (Mock) */}
            <div className="lg:col-span-2 p-6 border rounded-xl bg-background shadow-sm space-y-4 h-96 flex flex-col">
              <h2 className="font-bold text-lg">Traffic Overview</h2>
              <div className="flex-1 border-b border-l flex items-end justify-between px-2 pt-10 pb-0 relative">
                <div className="absolute top-0 left-0 text-xs text-muted-foreground w-full flex flex-col justify-between h-full pb-6 pl-2">
                  <span>10k</span>
                  <span>5k</span>
                  <span>0</span>
                </div>
                {/* Mock Bars */}
                {[40, 60, 45, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="w-[10%] bg-primary/20 hover:bg-primary transition-colors rounded-t-sm relative group cursor-pointer" style={{ height: `${h}%` }}>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      {h * 100} visits
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-2">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>

            {/* Sidebar Chart (Mock) */}
            <div className="p-6 border rounded-xl bg-background shadow-sm space-y-4 h-96 flex flex-col">
              <h2 className="font-bold text-lg">Top Sources</h2>
              <div className="flex-1 space-y-4 mt-4">
                {[
                  { name: "Google", value: "45%", w: "w-[45%]", color: "bg-blue-500" },
                  { name: "Direct", value: "25%", w: "w-[25%]", color: "bg-gray-500" },
                  { name: "Twitter", value: "15%", w: "w-[15%]", color: "bg-sky-500" },
                  { name: "Referral", value: "10%", w: "w-[10%]", color: "bg-green-500" },
                  { name: "Other", value: "5%", w: "w-[5%]", color: "bg-yellow-500" },
                ].map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">{item.value}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} ${item.w} rounded-full`}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Data Table */}
          <div className="border rounded-xl bg-background shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg">Recent Campaigns</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-4 font-medium">Campaign Name</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Clicks</th>
                    <th className="p-4 font-medium">Conversions</th>
                    <th className="p-4 font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { name: "Summer Sale 2024", status: "Active", clicks: "12,402", conv: "842", roi: "340%" },
                    { name: "Q3 Retargeting", status: "Active", clicks: "8,192", conv: "312", roi: "180%" },
                    { name: "Email Blast - June", status: "Completed", clicks: "45,012", conv: "1,204", roi: "450%" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-medium">{row.name}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="p-4">{row.clicks}</td>
                      <td className="p-4">{row.conv}</td>
                      <td className="p-4 text-green-600 font-medium">{row.roi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
