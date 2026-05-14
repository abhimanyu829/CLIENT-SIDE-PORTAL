"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("profile")

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile, security, and developer keys.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto hide-scrollbar">
        {[
          { id: "profile", label: "Profile" },
          { id: "security", label: "Security" },
          { id: "api", label: "API Keys" },
          { id: "notifications", label: "Notifications" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-background border rounded-xl shadow-sm p-6 sm:p-8">
        
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-xl font-bold mb-4">Personal Information</h2>
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                <div className="space-y-3 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                    AB
                  </div>
                  <Button variant="outline" size="sm">Change Avatar</Button>
                </div>
                <div className="flex-1 space-y-4 w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">First Name</label>
                      <input type="text" defaultValue="Acme" className="w-full border rounded-lg p-2.5 text-sm bg-background" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Last Name</label>
                      <input type="text" defaultValue="Corp" className="w-full border rounded-lg p-2.5 text-sm bg-background" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <input type="email" defaultValue="abhibhidevelopers@abhibhidevelopers.online" className="w-full border rounded-lg p-2.5 text-sm bg-muted text-muted-foreground" readOnly />
                    <p className="text-xs text-muted-foreground">To change your email, please contact support.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Timezone</label>
                    <select className="w-full border rounded-lg p-2.5 text-sm bg-background">
                      <option>Pacific Time (PT)</option>
                      <option>Eastern Time (ET)</option>
                      <option>Coordinated Universal Time (UTC)</option>
                    </select>
                  </div>
                  <Button className="mt-4">Save Changes</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Two-Factor Authentication (2FA)</h2>
              <p className="text-sm text-muted-foreground">Add an extra layer of security to your account by requiring a code from your authenticator app.</p>
              <div className="p-4 border rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-medium">Authenticator App</p>
                    <p className="text-sm text-muted-foreground">Not configured</p>
                  </div>
                </div>
                <Button>Enable 2FA</Button>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t">
              <h2 className="text-xl font-bold">Active Sessions</h2>
              <p className="text-sm text-muted-foreground">These are the devices that have logged into your account recently.</p>
              <div className="space-y-3">
                <div className="p-4 border rounded-xl flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💻</span>
                    <div>
                      <p className="font-medium flex items-center gap-2">Mac OS • Chrome <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">CURRENT</span></p>
                      <p className="text-sm text-muted-foreground">IP: 192.168.1.1 • Last active: Just now</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <div>
                      <p className="font-medium">iOS • Safari</p>
                      <p className="text-sm text-muted-foreground">IP: 10.0.0.5 • Last active: 2 hours ago</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 border-red-200">Revoke</Button>
                </div>
              </div>
              <Button variant="destructive" className="mt-2">Log out of all other devices</Button>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === "api" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">API Keys</h2>
                <p className="text-sm text-muted-foreground">Manage your secret keys for accessing the OpenClaude API.</p>
              </div>
              <Button>Generate New Key</Button>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-900/50 flex gap-3">
              <span className="text-yellow-600">⚠️</span>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Do not share your API keys in public repositories or client-side code. If a key is compromised, roll it immediately.
              </p>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Key Prefix</th>
                    <th className="p-4 font-medium">Last Used</th>
                    <th className="p-4 font-medium">Created</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="hover:bg-muted/10">
                    <td className="p-4 font-medium">Production Server</td>
                    <td className="p-4 font-mono text-muted-foreground">sk_live_abc123...</td>
                    <td className="p-4">10 mins ago</td>
                    <td className="p-4">May 01, 2024</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Revoke</Button>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/10">
                    <td className="p-4 font-medium">Local Dev</td>
                    <td className="p-4 font-mono text-muted-foreground">sk_test_xyz789...</td>
                    <td className="p-4">Never</td>
                    <td className="p-4">Yesterday</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Revoke</Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-xl font-bold mb-4">Notification Preferences</h2>
              <p className="text-sm text-muted-foreground mb-6">Choose what updates you want to receive via email.</p>
              
              <div className="space-y-6">
                {[
                  { title: "Product Updates", desc: "News about major new features and updates.", default: true },
                  { title: "Billing & Invoices", desc: "Receipts and renewal reminders. (Cannot be disabled)", default: true, disabled: true },
                  { title: "API Usage Alerts", desc: "Notifications when you approach your rate limits.", default: true },
                  { title: "Marketing & Promos", desc: "Occasional discounts and promotional offers.", default: false },
                ].map((pref, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{pref.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pref.desc}</p>
                    </div>
                    <label className={`relative inline-flex items-center ${pref.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                      <input type="checkbox" className="sr-only peer" defaultChecked={pref.default} disabled={pref.disabled} />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
              <Button className="mt-8">Save Preferences</Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
