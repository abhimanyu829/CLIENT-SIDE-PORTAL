"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Role } from "@prisma/client"
import {
  revokeSession,
  updateAdminRole,
  createApiKey,
  revokeApiKey
} from "./actions"
import {
  ShieldCheck, Search, ShieldAlert, Key, Globe, Layout, UserCheck,
  Plus, Trash2, X, RefreshCw, Layers, Check, ChevronDown, ChevronUp
} from "lucide-react"

interface AuditLog {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  beforeJson: any
  afterJson: any
  ip: string | null
  userAgent: string | null
  createdAt: string
  user?: { name: string | null; email: string } | null
}

interface Session {
  id: string
  sessionToken: string
  userId: string
  expires: string
  createdAt: string
  user: { id: string; name: string | null; email: string; role: Role }
}

interface ApiKey {
  id: string
  key: string
  prefix: string
  name: string
  rateLimit: number
  lastUsedAt: string | null
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  user: { name: string | null; email: string }
}

interface AdminUser {
  id: string
  name: string | null
  email: string
  role: Role
  department: string | null
  permissions: string[]
}

interface Props {
  initialLogs: AuditLog[]
  sessions: Session[]
  apiKeys: ApiKey[]
  adminUsers: AdminUser[]
  isSuperAdmin: boolean
}

export default function AdminAuditClient({
  initialLogs, sessions, apiKeys, adminUsers, isSuperAdmin
}: Props) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("logs")
  const [loading, setLoading] = useState(false)

  // Expandable JSON diff state
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Filtering logs
  const [searchActor, setSearchActor] = useState("")
  const [filterAction, setFilterAction] = useState("")

  // Security Policy Mock Rules
  const [ipRules, setIpRules] = useState([
    { id: "1", type: "WHITELIST", ip: "192.168.1.1/32", note: "Office HQ Gateway" },
    { id: "2", type: "BLACKLIST", ip: "203.0.113.50", note: "Flagged brute force source" },
  ])
  const [newIpType, setNewIpType] = useState<"WHITELIST" | "BLACKLIST">("WHITELIST")
  const [newIpRange, setNewIpRange] = useState("")
  const [newIpNote, setNewIpNote] = useState("")

  // API Key creation
  const [apiKeyModal, setApiKeyModal] = useState(false)
  const [keyName, setKeyName] = useState("")
  const [keyRateLimit, setKeyRateLimit] = useState("1000")
  const [keyExpires, setKeyExpires] = useState("")
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null)

  // RBAC Assignment state
  const [rbacModal, setRbacModal] = useState<AdminUser | null>(null)
  const [rbacRole, setRbacRole] = useState<Role>("SUB_ADMIN")
  const [rbacDept, setRbacDept] = useState("")
  const [rbacPerms, setRbacPerms] = useState<string[]>([])

  // Destructive confirmations
  const [confirmRevokeSession, setConfirmRevokeSession] = useState<string | null>(null)
  const [confirmRevokeApiKey, setConfirmRevokeApiKey] = useState<string | null>(null)

  const handleRevokeSession = async () => {
    if (!confirmRevokeSession) return
    setLoading(true)
    try {
      await revokeSession(confirmRevokeSession)
      toast({ title: "Session Terminated", description: "Successfully revoked session. User will be logged out." })
      setConfirmRevokeSession(null)
      window.location.reload()
    } catch (e: any) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeKey = async () => {
    if (!confirmRevokeApiKey) return
    setLoading(true)
    try {
      await revokeApiKey(confirmRevokeApiKey)
      toast({ title: "API Key Revoked", description: "This credentials token is now deactivated." })
      setConfirmRevokeApiKey(null)
      window.location.reload()
    } catch (e: any) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateKey = async () => {
    if (!keyName) return
    setLoading(true)
    try {
      const res = await createApiKey({
        name: keyName,
        rateLimit: Number(keyRateLimit),
        expiresAt: keyExpires || null
      })
      setCreatedRawKey(res.key)
      toast({ title: "API Key Created", description: "Make sure to copy the key as it won't be shown again." })
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRbac = async () => {
    if (!rbacModal) return
    setLoading(true)
    try {
      await updateAdminRole({
        userId: rbacModal.id,
        role: rbacRole,
        department: rbacDept || null,
        permissions: rbacPerms
      })
      toast({ title: "Permissions Updated", description: "Successfully assigned new roles and access permissions." })
      setRbacModal(null)
      window.location.reload()
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const addIpRule = () => {
    if (!newIpRange) return
    setIpRules([...ipRules, { id: Math.random().toString(), type: newIpType, ip: newIpRange, note: newIpNote }])
    setNewIpRange("")
    setNewIpNote("")
    toast({ title: "IP Access Rule Saved", description: "Successfully saved firewall policy override." })
  }

  const deleteIpRule = (id: string) => {
    setIpRules(ipRules.filter(r => r.id !== id))
    toast({ title: "Rule Deleted", description: "Firewall entry removed." })
  }

  const togglePermission = (perm: string) => {
    if (rbacPerms.includes(perm)) {
      setRbacPerms(rbacPerms.filter(p => p !== perm))
    } else {
      setRbacPerms([...rbacPerms, perm])
    }
  }

  const filteredLogs = initialLogs.filter((log) => {
    const email = log.user?.email || "system"
    const actorMatch = email.toLowerCase().includes(searchActor.toLowerCase())
    const actionMatch = !filterAction || log.action.toLowerCase().includes(filterAction.toLowerCase())
    return actorMatch && actionMatch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Security & Auditing</h1>
          <p className="text-sm text-muted-foreground">Manage admin access controls, active sessions, dynamic API keys, and review audit trail diff logs.</p>
        </div>
      </div>

      <div className="flex border-b overflow-x-auto">
        {[
          { id: "logs", label: "Audit Trails", icon: ShieldCheck },
          { id: "sessions", label: "Sessions", icon: Globe },
          { id: "keys", label: "API Keys", icon: Key },
          { id: "rbac", label: "RBAC Settings", icon: UserCheck },
          { id: "policies", label: "Policies & IP Firewall", icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 1. AUDIT TRAILS TAB */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 bg-card grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Search Actor Email</label>
              <Input
                placeholder="e.g. admin@company.com"
                value={searchActor}
                onChange={(e) => setSearchActor(e.target.value)}
                className="text-xs h-9 mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Filter Action</label>
              <Input
                placeholder="e.g. USER_BLOCKED"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="text-xs h-9 mt-1"
              />
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px]">
                    <th className="px-6 py-2.5">Time</th>
                    <th className="px-6 py-2.5">Actor</th>
                    <th className="px-6 py-2.5">Action Code</th>
                    <th className="px-6 py-2.5">Entity / ID</th>
                    <th className="px-6 py-2.5">IP Address</th>
                    <th className="px-6 py-2.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-xs">No matching audits logs found</td></tr>
                  ) : filteredLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id
                    return (
                      <>
                        <tr key={log.id} className="hover:bg-muted/10 font-sans">
                          <td className="px-6 py-3 text-xs text-muted-foreground font-mono">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="px-6 py-3 text-xs">
                            <p className="font-semibold text-zinc-700 dark:text-zinc-300">{log.user?.name || "System Orchestrator"}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{log.user?.email || "internal_cron"}</p>
                          </td>
                          <td className="px-6 py-3 font-mono text-xs font-bold text-violet-600">{log.action}</td>
                          <td className="px-6 py-3 font-mono text-[10px] text-zinc-500">{log.entity} · {log.entityId || "—"}</td>
                          <td className="px-6 py-3 font-mono text-[10px]">{log.ip || "127.0.0.1"}</td>
                          <td className="px-6 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs flex items-center gap-1 ml-auto"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            >
                              JSON {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/30">
                            <td colSpan={6} className="px-6 py-3 text-xs font-mono border-t border-b">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-2 border rounded bg-zinc-950 text-emerald-400 max-h-[200px] overflow-y-auto">
                                  <span className="text-[10px] text-zinc-500 uppercase block mb-1">State Before:</span>
                                  <pre className="text-[11px] whitespace-pre-wrap">{JSON.stringify(log.beforeJson, null, 2) || "None"}</pre>
                                </div>
                                <div className="p-2 border rounded bg-zinc-950 text-indigo-400 max-h-[200px] overflow-y-auto">
                                  <span className="text-[10px] text-zinc-500 uppercase block mb-1">State After:</span>
                                  <pre className="text-[11px] whitespace-pre-wrap">{JSON.stringify(log.afterJson, null, 2) || "None"}</pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACTIVE SESSIONS TAB */}
      {activeTab === "sessions" && (
        <div className="rounded-xl border overflow-hidden bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px]">
                <th className="px-6 py-2.5">User Email</th>
                <th className="px-6 py-2.5">Role</th>
                <th className="px-6 py-2.5">Token Prefix</th>
                <th className="px-6 py-2.5">Expires</th>
                <th className="px-6 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-muted/10">
                  <td className="px-6 py-3 font-semibold text-xs">{s.user.email}</td>
                  <td className="px-6 py-3">
                    <Badge variant="outline" className={s.user.role === "SUPER_ADMIN" ? "border-red-200 text-red-700 bg-red-50/20" : ""}>{s.user.role}</Badge>
                  </td>
                  <td className="px-6 py-3 font-mono text-[10px] text-muted-foreground">{s.sessionToken.slice(0, 15)}...</td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">{new Date(s.expires).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-red-600 border-red-100 hover:bg-red-50"
                      onClick={() => setConfirmRevokeSession(s.id)}
                    >
                      Force Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. API KEYS TAB */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setApiKeyModal(true); setCreatedRawKey(null); setKeyName("") }} size="sm" className="bg-violet-600 hover:bg-violet-700">
              <Plus className="h-4 w-4 mr-1" /> Generate API Key
            </Button>
          </div>

          <div className="rounded-xl border overflow-hidden bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px]">
                  <th className="px-6 py-2.5">Key Name</th>
                  <th className="px-6 py-2.5">Prefix Token</th>
                  <th className="px-6 py-2.5">Actor User</th>
                  <th className="px-6 py-2.5">Rate Limit / Min</th>
                  <th className="px-6 py-2.5">Status</th>
                  <th className="px-6 py-2.5 text-right">Revoke Key</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {apiKeys.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-xs">No admin API keys registered</td></tr>
                ) : apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-muted/10 font-mono text-xs">
                    <td className="px-6 py-3 font-sans font-semibold text-zinc-800 dark:text-zinc-200">{k.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{k.prefix}...</td>
                    <td className="px-6 py-3 font-sans">{k.user.email}</td>
                    <td className="px-6 py-3">{k.rateLimit} req/m</td>
                    <td className="px-6 py-3 font-sans">
                      <Badge className={k.isActive ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"} variant="secondary">
                        {k.isActive ? "Active" : "Revoked"}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {k.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600"
                          onClick={() => setConfirmRevokeApiKey(k.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. RBAC SETTINGS TAB */}
      {activeTab === "rbac" && (
        <div className="space-y-4">
          {!isSuperAdmin && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/20 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Access Warning</p>
                <p className="mt-0.5">Only Superadmins can modify administrator roles, access logs, or customize specific access controls permissions.</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border overflow-hidden bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px]">
                  <th className="px-6 py-2.5">Name</th>
                  <th className="px-6 py-2.5">Email</th>
                  <th className="px-6 py-2.5">Role Type</th>
                  <th className="px-6 py-2.5">Department</th>
                  <th className="px-6 py-2.5">Granted Permissions</th>
                  <th className="px-6 py-2.5 text-right">Configure</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {adminUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/10 text-xs">
                    <td className="px-6 py-3 font-semibold">{u.name || "System Actor"}</td>
                    <td className="px-6 py-3 font-mono">{u.email}</td>
                    <td className="px-6 py-3 font-mono">
                      <Badge className={u.role === "SUPER_ADMIN" ? "bg-red-100 text-red-800 font-bold" : "bg-violet-100 text-violet-800"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 font-semibold text-zinc-600 dark:text-zinc-400">{u.department || "Engineering"}</td>
                    <td className="px-6 py-3 max-w-[200px] truncate font-mono text-[10px] text-muted-foreground">
                      {u.permissions.length === 0 ? "Default subadmin" : u.permissions.join(", ")}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        disabled={!isSuperAdmin}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setRbacModal(u)
                          setRbacRole(u.role)
                          setRbacDept(u.department || "")
                          setRbacPerms(u.permissions)
                        }}
                      >
                        Adjust RBAC
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. POLICIES & IP FIREWALL TAB */}
      {activeTab === "policies" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
            <h2 className="text-base font-bold flex items-center gap-1.5"><Globe className="h-5 w-5 text-indigo-500" /> IP Whitelist & Blacklist Firewall Rules</h2>
            <p className="text-xs text-muted-foreground">Enforce firewall policies on administrative API endpoints.</p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Rule Type</label>
                  <select
                    className="w-full mt-1 border rounded-lg px-2 py-1.5 text-xs bg-background"
                    value={newIpType}
                    onChange={(e) => setNewIpType(e.target.value as any)}
                  >
                    <option value="WHITELIST">ALLOW RANGE (Whitelist)</option>
                    <option value="BLACKLIST">BLOCK RANGE (Blacklist)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">IP Range / CIDR</label>
                  <Input value={newIpRange} onChange={(e) => setNewIpRange(e.target.value)} placeholder="e.g. 192.168.1.0/24" className="h-8 mt-1 text-xs" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Internal Memo Note</label>
                <Input value={newIpNote} onChange={(e) => setNewIpNote(e.target.value)} placeholder="e.g. Secure VPN connection office gateway" className="h-8 mt-1 text-xs" />
              </div>

              <div className="flex justify-end pt-1">
                <Button onClick={addIpRule} size="sm" className="bg-indigo-600 hover:bg-indigo-700">Add Firewall Entry</Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Active Access Rule Controls</span>
              <div className="space-y-2 max-h-[160px] overflow-y-auto">
                {ipRules.map((rule) => (
                  <div key={rule.id} className="flex justify-between items-center text-xs p-2 rounded border bg-muted/20">
                    <div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mr-2 ${
                        rule.type === "WHITELIST" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}>{rule.type}</span>
                      <span className="font-mono">{rule.ip}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{rule.note}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => deleteIpRule(rule.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border rounded-xl p-5 bg-card shadow-sm space-y-4">
            <h2 className="text-base font-bold flex items-center gap-1.5"><ShieldCheck className="h-5 w-5 text-emerald-500" /> Security Policies Settings</h2>
            <p className="text-xs text-muted-foreground">Global administrative panel security rules enforcement parameters.</p>

            <div className="space-y-4">
              <div className="border rounded-lg p-3 bg-muted/15 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold block">Require Administrator 2FA verification</span>
                  <span className="text-[10px] text-muted-foreground">Force all admin roles to complete authentication MFA code challenges.</span>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800">ENFORCED</Badge>
              </div>

              <div className="border rounded-lg p-3 bg-muted/15 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold block">Admin Panel Inactivity Auto Logout</span>
                  <span className="text-[10px] text-muted-foreground">Revoke active sessions after 30 minutes of console idle time.</span>
                </div>
                <Badge className="bg-blue-100 text-blue-800">30 MINS</Badge>
              </div>

              <div className="border rounded-lg p-3 bg-muted/15 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold block">Global API Key Rate Limit configuration</span>
                  <span className="text-[10px] text-muted-foreground">Adjust maximum transactions endpoints requests volume.</span>
                </div>
                <Badge className="bg-zinc-100 text-zinc-800">100 req/min</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate API Key modal */}
      {apiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border rounded-xl w-full max-w-md p-6 relative shadow-2xl space-y-4">
            <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => setApiKeyModal(false)}>
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold flex items-center gap-1.5"><Key className="h-5 w-5 text-indigo-500" /> Create Administrator API Credentials Token</h2>

            {createdRawKey ? (
              <div className="space-y-3">
                <p className="text-xs text-amber-600 font-semibold">Copy this API token now. You will not be able to retrieve it again:</p>
                <div className="p-3 border rounded bg-zinc-950 text-indigo-400 font-mono text-xs break-all select-all flex items-center justify-between">
                  <span>{createdRawKey}</span>
                </div>
                <Button onClick={() => setApiKeyModal(false)} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">Done</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Key Name</label>
                  <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Jenkins Deploy Server key" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Rate Limit (req/min)</label>
                    <Input type="number" value={keyRateLimit} onChange={(e) => setKeyRateLimit(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Expiration Date</label>
                    <Input type="date" value={keyExpires} onChange={(e) => setKeyExpires(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" size="sm" onClick={() => setApiKeyModal(false)}>Cancel</Button>
                  <Button onClick={handleGenerateKey} size="sm" className="bg-indigo-600 hover:bg-indigo-700">Generate Token</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RBAC Edit Modal */}
      {rbacModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border rounded-xl w-full max-w-lg p-6 relative shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => setRbacModal(null)}>
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold">Configure Administrative Roles & Permissions</h2>
            <p className="text-xs text-muted-foreground">Adjust security levels for: <span className="font-semibold text-violet-600">{rbacModal.email}</span></p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Administrator Role</label>
                  <select
                    className="w-full mt-1 border rounded-lg px-3 py-1.5 text-sm bg-background"
                    value={rbacRole}
                    onChange={(e) => setRbacRole(e.target.value as Role)}
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Full control)</option>
                    <option value="SUB_ADMIN">SUB_ADMIN (Standard controls)</option>
                    <option value="GUEST">GUEST (Read-only views)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Operating Department</label>
                  <select
                    className="w-full mt-1 border rounded-lg px-3 py-1.5 text-sm bg-background"
                    value={rbacDept}
                    onChange={(e) => setRbacDept(e.target.value)}
                  >
                    <option value="">None (Default)</option>
                    <option value="TECH">TECH</option>
                    <option value="MARKETING">MARKETING</option>
                    <option value="FINANCE">FINANCE</option>
                    <option value="AI">AI</option>
                    <option value="OPERATIONS">OPERATIONS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5">Granular Permissions List</label>
                <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/20">
                  {[
                    "read_billing",
                    "write_products",
                    "view_users",
                    "block_users",
                    "issue_refunds",
                    "manage_coupons",
                  ].map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={rbacPerms.includes(perm)}
                        onChange={() => togglePermission(perm)}
                      />
                      <span className="font-mono">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => setRbacModal(null)}>Cancel</Button>
                <Button onClick={handleSaveRbac} size="sm" className="bg-violet-600 hover:bg-violet-700">Save Permissions</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Session Confirmation */}
      <ConfirmDialog
        open={!!confirmRevokeSession}
        onClose={() => setConfirmRevokeSession(null)}
        onConfirm={handleRevokeSession}
        title="Revoke Administrator Session"
        description="Are you sure you want to force log out this admin session? The user will have to authenticate again."
        destructive
      />

      {/* Revoke API Key Confirmation */}
      <ConfirmDialog
        open={!!confirmRevokeApiKey}
        onClose={() => setConfirmRevokeApiKey(null)}
        onConfirm={handleRevokeKey}
        title="Revoke API Access Credentials"
        description="WARNING: Revoking this API Key will immediately block all software integrations using these credentials. This action cannot be undone."
        destructive
      />
    </div>
  )
}
