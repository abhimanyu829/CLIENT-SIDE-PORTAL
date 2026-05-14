"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface AdminProduct {
  id: string
  name: string
  slug: string
  status: string
  thumbnailUrl: string | null
  tiers: { id: string; name: string; price: number; currency: string }[]
  _count: { subscriptions: number }
  updatedAt: Date
}

export default function AdminProductsClient({ initialProducts }: { initialProducts: AdminProduct[] }) {
  const [view, setView] = useState<"list" | "edit">("list")
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null)

  const handleEdit = (product: AdminProduct) => {
    setSelectedProduct(product)
    setView("edit")
  }

  const handleNew = () => {
    setSelectedProduct(null)
    setView("edit")
  }

  if (view === "edit") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setView("list")}>← Back to Products</Button>
          <h1 className="text-2xl font-bold">{selectedProduct?.id ? "Edit Product" : "Create New Product"}</h1>
          <div className="flex-1" />
          <Button variant="outline" className="text-blue-600 border-blue-200">Sync with Stripe</Button>
          <Button>Save Product</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-background border rounded-xl p-6 shadow-sm space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Name</label>
                <input type="text" defaultValue={selectedProduct?.name} className="w-full border rounded-lg p-2.5 text-sm bg-background" placeholder="e.g., Advanced Analytics" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <input type="text" defaultValue={selectedProduct?.slug} className="w-full border rounded-lg p-2.5 text-sm bg-background" placeholder="e.g., advanced-analytics" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea className="w-full p-3 min-h-[150px] text-sm bg-background border rounded-lg focus:outline-none" placeholder="Write a compelling description..." />
              </div>
            </div>

            <div className="bg-background border rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-lg">Pricing Tiers</h2>
              <div className="space-y-3">
                {selectedProduct?.tiers?.map(tier => (
                  <div key={tier.id} className="p-4 border rounded-lg flex items-center gap-4 bg-muted/10">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm">{tier.name}</p>
                    </div>
                    <div className="w-24 text-right font-medium text-sm">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: tier.currency }).format(tier.price)}
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-500">×</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed">Add Pricing Tier</Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-background border rounded-xl p-6 shadow-sm space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select className="w-full border rounded-lg p-2.5 text-sm bg-background" defaultValue={selectedProduct?.status}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            <div className="bg-background border rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-sm">Thumbnail</h2>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center text-center text-muted-foreground cursor-pointer hover:bg-muted/10 transition-colors">
                <span className="text-3xl mb-2">🖼</span>
                <span className="text-sm">Click to upload or drag and drop</span>
                <span className="text-xs mt-1">SVG, PNG, JPG (max 2MB)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your SaaS offerings and pricing tiers.</p>
        </div>
        <Button onClick={handleNew}>Create Product</Button>
      </div>

      <div className="bg-background border rounded-xl shadow-sm flex-1 overflow-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-4 font-medium w-12"><input type="checkbox" className="rounded" /></th>
              <th className="p-4 font-medium">Product</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Base Price</th>
              <th className="p-4 font-medium">Subscribers</th>
              <th className="p-4 font-medium">Updated</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {initialProducts.map(prod => (
              <tr key={prod.id} className="hover:bg-muted/10 transition-colors">
                <td className="p-4"><input type="checkbox" className="rounded" /></td>
                <td className="p-4 font-medium">{prod.name}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                    prod.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {prod.status}
                  </span>
                </td>
                <td className="p-4 text-muted-foreground">
                  {prod.tiers[0]
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: prod.tiers[0].currency }).format(prod.tiers[0].price) + "/mo"
                    : "—"}
                </td>
                <td className="p-4">{prod._count.subscriptions}</td>
                <td className="p-4 text-xs text-muted-foreground">{new Date(prod.updatedAt).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(prod)}>Edit</Button>
                </td>
              </tr>
            ))}
            {initialProducts.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
