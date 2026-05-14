"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Subscription {
  id: string
  status: string
  currentPeriodEnd: Date
  product: { name: string }
  tier: { name: string, price: any }
}

interface Invoice {
  id: string
  number: string
  totalAmount: any
  currency: string
  status: string
  issuedAt: Date
  pdfUrl: string | null
}

export default function SubscriptionsClient({ 
  subscriptions, 
  invoices 
}: { 
  subscriptions: Subscription[], 
  invoices: Invoice[] 
}) {
  const [showManageModal, setShowManageModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedSub, setSelectedSub] = useState<string | null>(null)

  const openManage = (id: string) => {
    setSelectedSub(id)
    setShowManageModal(true)
  }

  const openCancel = (id: string) => {
    setSelectedSub(id)
    setShowCancelModal(true)
  }

  return (
    <div className="space-y-8 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Manage your active products and billing cycles.</p>
        </div>
        <Button>Browse Products</Button>
      </div>

      {/* Active Subscriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subscriptions.length === 0 ? (
          <div className="p-6 border rounded-xl text-center text-muted-foreground bg-background shadow-sm md:col-span-2">
            No active subscriptions found.
          </div>
        ) : (
          subscriptions.map(sub => (
            <div key={sub.id} className="border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold">{sub.product.name}</h2>
                    <p className="text-sm text-muted-foreground">{sub.tier.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    sub.status === 'ACTIVE' || sub.status === 'TRIALING'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {sub.status}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Pricing</p>
                    <p className="font-bold">${Number(sub.tier.price).toFixed(2)}/mo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Next Renewal</p>
                    <p className="font-medium">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-muted/20 flex justify-between gap-4 mt-auto">
                <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 border-red-200" onClick={() => openCancel(sub.id)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={() => openManage(sub.id)}>
                  Manage Plan
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Billing History */}
      <div className="border rounded-xl bg-background shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b bg-muted/10">
          <h2 className="text-xl font-bold">Billing History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No billing history found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                    <td className="p-4 font-medium">Invoice #{inv.number}</td>
                    <td className="p-4">
                      {inv.currency === 'usd' ? '$' : inv.currency.toUpperCase() + ' '}{Number(inv.totalAmount).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        inv.status === 'PAID' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {inv.pdfUrl ? (
                        <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline text-primary">
                          Download PDF
                        </a>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals (Mock) */}
      {showManageModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-6">
            <h3 className="text-xl font-bold">Change Plan</h3>
            <p className="text-sm text-muted-foreground">Select a new tier for this subscription. Proration will be calculated automatically.</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <span className="font-medium">Hobby</span>
                <span className="font-bold">$19/mo</span>
              </label>
              <label className="flex items-center justify-between p-3 border-2 border-primary bg-primary/5 rounded-lg cursor-pointer">
                <span className="font-medium">Pro</span>
                <span className="font-bold">$49/mo</span>
              </label>
              <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <span className="font-medium">Enterprise</span>
                <span className="font-bold">$199/mo</span>
              </label>
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowManageModal(false)}>Cancel</Button>
              <Button>Confirm Change</Button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-6">
            <h3 className="text-xl font-bold text-red-600">Cancel Subscription</h3>
            <p className="text-sm">Are you sure you want to cancel? You will lose access to this product at the end of your current billing period.</p>
            <textarea className="w-full border rounded-md p-3 text-sm bg-background" placeholder="Reason for cancellation (optional)" rows={3}></textarea>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>Keep Subscription</Button>
              <Button variant="destructive">Yes, Cancel</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
