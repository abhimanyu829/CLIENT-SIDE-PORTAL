import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import ProductCard from "@/components/marketplace/ProductCard"
import { db } from "@/lib/db"
import { ProductStatus } from "@prisma/client"

async function getProducts() {
  return await db.product.findMany({
    where: { status: ProductStatus.PUBLISHED },
    orderBy: { createdAt: "desc" },
    include: { tiers: { take: 1, orderBy: { price: "asc" } } },
  })
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex flex-col space-y-3 p-4 border rounded-xl shadow-sm animate-pulse">
          <div className="w-full h-[150px] bg-muted rounded-md" />
          <div className="h-6 w-3/4 bg-muted rounded-md" />
          <div className="h-4 w-full bg-muted rounded-md" />
          <div className="h-4 w-1/2 bg-muted rounded-md" />
          <div className="flex justify-between items-center pt-4">
            <div className="h-6 w-1/4 bg-muted rounded-md" />
            <div className="h-8 w-1/3 bg-muted rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

async function ProductGrid() {
  const products = await getProducts()
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 space-y-8 flex-shrink-0">
        <div>
          <h2 className="font-bold text-lg mb-4">Search</h2>
          <input 
            type="search" 
            placeholder="Search products..." 
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <div>
          <h2 className="font-bold text-lg mb-4">Categories</h2>
          <div className="space-y-2">
            {["All", "Support", "Sales", "Marketing", "Analytics", "Creative"].map((cat) => (
              <label key={cat} className="flex items-center space-x-2 text-sm cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                <span>{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-bold text-lg mb-4">Price Range</h2>
          <div className="flex items-center space-x-2">
            <input type="number" placeholder="Min" className="w-full px-2 py-1 border rounded text-sm" />
            <span>-</span>
            <input type="number" placeholder="Max" className="w-full px-2 py-1 border rounded text-sm" />
          </div>
        </div>
        
        <div>
          <h2 className="font-bold text-lg mb-4">Rating</h2>
          <div className="space-y-2">
            {[4, 3, 2, 1].map((rating) => (
              <label key={rating} className="flex items-center space-x-2 text-sm cursor-pointer">
                <input type="radio" name="rating" className="text-primary focus:ring-primary" />
                <span>{rating} Stars & Up</span>
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">AI Models & Tools</h1>
          <select className="border rounded-md px-3 py-2 text-sm bg-background">
            <option>Sort by: Featured</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
            <option>Highest Rated</option>
          </select>
        </div>
        
        <Suspense fallback={<ProductGridSkeleton />}>
          <ProductGrid />
        </Suspense>
      </main>
    </div>
  )
}
