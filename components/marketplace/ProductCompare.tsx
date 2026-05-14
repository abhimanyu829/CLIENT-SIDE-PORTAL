"use client"

import { Button } from "@/components/ui/button"
import { useCompareStore } from "@/stores/compareStore"
import Link from "next/link"

export default function ProductCompare() {
  const { comparedProducts, removeProduct, clearCompare } = useCompareStore()
  
  if (comparedProducts.length === 0) return null

  const compareUrl = `/compare?ids=${comparedProducts.map(p => p.id).join(',')}`

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50 transform transition-transform duration-300">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-semibold">{comparedProducts.length} items selected to compare</span>
          <div className="flex gap-2">
            {comparedProducts.map(product => (
              <div key={product.id} className="w-auto px-3 h-10 bg-muted rounded-md border flex items-center justify-center text-xs relative group" title={product.name}>
                {product.name}
                <button 
                  onClick={() => removeProduct(product.id)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={clearCompare} className="flex-1 sm:flex-none">
            Clear All
          </Button>
          <Button className="flex-1 sm:flex-none" disabled={comparedProducts.length < 2} asChild>
            <Link href={compareUrl}>
              Compare Now
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
