"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Invoice {
  id: string
  number: string
  totalAmount: any
  currency: string
  status: string
  issuedAt: Date
  pdfUrl: string | null
}

export default function InvoicesClient({ invoices }: { invoices: Invoice[] }) {
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const openPayModal = (inv: Invoice) => {
    setSelectedInvoice(inv)
    setShowPayModal(true)
  }

  const outstandingBalance = invoices
    .filter(i => i.status !== 'PAID')
    .reduce((acc, curr) => acc + Number(curr.totalAmount), 0)

  const paidThisYear = invoices
    .filter(i => i.status === 'PAID' && new Date(i.issuedAt).getFullYear() === new Date().getFullYear())
    .reduce((acc, curr) => acc + Number(curr.totalAmount), 0)

  // Find next unpaid invoice sorted by issuedAt ascending (earliest unpaid)
  const nextInvoiceDue = [...invoices].filter(i => i.status !== 'PAID').sort((a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime())[0]

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage your billing, payments, and receipts.</p>
        </div>
        <Button variant="outline">Update Billing Info</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="border rounded-xl p-6 bg-background shadow-sm space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Outstanding Balance</p>
          <p className="text-3xl font-bold text-red-600">${outstandingBalance.toFixed(2)}</p>
        </div>
        <div className="border rounded-xl p-6 bg-background shadow-sm space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Paid This Year</p>
          <p className="text-3xl font-bold">${paidThisYear.toFixed(2)}</p>
        </div>
        <div className="border rounded-xl p-6 bg-background shadow-sm space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Next Invoice Due</p>
          <p className="text-3xl font-bold">{nextInvoiceDue ? new Date(nextInvoiceDue.issuedAt).toLocaleDateString() : 'None'}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/20 p-4 border rounded-xl">
        <div className="flex gap-2 w-full sm:w-auto">
          <input type="text" placeholder="Search invoices..." className="border rounded-lg px-3 py-2 text-sm flex-1 sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary" />
          <select className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background">
            <option>All Statuses</option>
            <option>PAID</option>
            <option>PENDING</option>
            <option>OVERDUE</option>
          </select>
        </div>
        <Button variant="ghost" size="sm" className="w-full sm:w-auto">Download All (CSV)</Button>
      </div>

      {/* Invoice Table */}
      <div className="border rounded-xl bg-background shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 font-medium">Invoice Number</th>
                <th className="p-4 font-medium">Date Issued</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground bg-background">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors bg-background">
                    <td className="p-4 font-medium">{inv.number}</td>
                    <td className="p-4">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                    <td className="p-4 font-bold">
                      {inv.currency === 'usd' ? '$' : inv.currency.toUpperCase() + ' '}{Number(inv.totalAmount).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        inv.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      {inv.status !== 'PAID' && (
                        <Button size="sm" onClick={() => openPayModal(inv)}>Pay Now</Button>
                      )}
                      {inv.pdfUrl ? (
                        <a href={inv.pdfUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">PDF</Button>
                        </a>
                      ) : (
                        <Button variant="outline" size="sm" disabled>PDF</Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Now Modal */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b bg-muted/20 text-center space-y-2">
              <p className="text-sm text-muted-foreground uppercase font-semibold">Payment Due</p>
              <h3 className="text-3xl font-bold">${Number(selectedInvoice.totalAmount).toFixed(2)}</h3>
              <p className="text-sm font-medium">Invoice {selectedInvoice.number}</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium text-sm border-b pb-2">Select Payment Method</h4>
                <label className="flex items-center justify-between p-3 border-2 border-primary bg-primary/5 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💳</span>
                    <div>
                      <p className="font-medium">Visa ending in 4242</p>
                      <p className="text-xs text-muted-foreground">Expires 12/25</p>
                    </div>
                  </div>
                  <input type="radio" name="payment_method" defaultChecked className="text-primary" />
                </label>
                <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🏛️</span>
                    <div>
                      <p className="font-medium">Bank Transfer</p>
                      <p className="text-xs text-muted-foreground">Takes 3-5 business days</p>
                    </div>
                  </div>
                  <input type="radio" name="payment_method" className="text-primary" />
                </label>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setShowPayModal(false)}>Cancel</Button>
                <Button className="w-full">Pay ${Number(selectedInvoice.totalAmount).toFixed(2)}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
