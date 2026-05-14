"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useCompareStore } from "@/stores/compareStore"
import { ProductType } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

interface ProductTierMin {
  price: Decimal
  currency: string
}

interface Product {
  id: string
  slug: string
  name: string
  description: string
  type: ProductType
  averageRating: number
  thumbnailUrl?: string | null
  tiers?: ProductTierMin[]
}

interface ProductCardProps {
  product: Product
}

const TYPE_LABELS: Record<ProductType, string> = {
  SAAS: "SaaS",
  SERVICE: "Service",
  AI_AGENT: "AI Agent",
  CUSTOM: "Custom",
}

export default function ProductCard({ product }: ProductCardProps) {
  const { comparedProducts, addProduct, removeProduct } = useCompareStore()
  const isCompared = comparedProducts.some(p => p.id === product.id)

  const lowestTier = product.tiers?.[0]
  const priceDisplay = lowestTier
    ? `$${Number(lowestTier.price).toFixed(0)}`
    : "Free"

  return (
    <div className="flex flex-col group overflow-hidden border rounded-xl bg-background transition-all hover:shadow-md">
      <Link href={`/marketplace/${product.slug}`} className="block">
        {/* Thumbnail / Placeholder */}
        <div className="w-full aspect-video bg-muted relative overflow-hidden flex items-center justify-center">
          {product.thumbnailUrl ? (
            <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">🤖</span>
          )}
        </div>
      </Link>
      
      <div className="p-5 flex flex-col flex-1 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <Link href={`/marketplace/${product.slug}`}>
            <h3 className="font-bold text-lg leading-tight hover:text-primary transition-colors line-clamp-1">{product.name}</h3>
          </Link>
          <span className="inline-flex items-center text-xs font-medium bg-secondary text-secondary-foreground px-2 py-1 rounded-full whitespace-nowrap">
            {TYPE_LABELS[product.type] ?? product.type}
          </span>
        </div>
        
        <p className="text-muted-foreground text-sm line-clamp-2 flex-1">
          {product.description}
        </p>
        
        {product.averageRating > 0 && (
          <div className="flex items-center gap-1 text-sm text-yellow-500 font-medium">
            ★ {product.averageRating.toFixed(1)}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold">{priceDisplay}</span>
            {lowestTier && <span className="text-xs text-muted-foreground">/mo</span>}
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs flex items-center gap-1 cursor-pointer hover:text-primary transition-colors">
              <input 
                type="checkbox" 
                className="rounded border-input text-primary focus:ring-primary"
                checked={isCompared}
                onChange={(e) => {
                  if (e.target.checked) {
                    addProduct({ id: product.id, name: product.name, slug: product.slug })
                  } else {
                    removeProduct(product.id)
                  }
                }}
              />
              Compare
            </label>
            <Link href={`/marketplace/${product.slug}`}>
              <Button size="sm" variant="outline">Details</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
