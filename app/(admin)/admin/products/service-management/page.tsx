import Link from "next/link"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Package, Settings2 } from "lucide-react"

export const metadata = { title: "Product Service Management - NexusAI Admin" }

export default async function ProductServiceManagementPage() {
  await requireAdmin()

  const products = await db.product.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      status: true,
      category: true,
      serviceProfile: {
        select: {
          isPublished: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  })

  const configured = products.filter((product) => product.serviceProfile).length

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Admin / Products</p>
          <h1 className="text-3xl font-bold tracking-tight">Product Service Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage owner-facing plan capacity, included services, paid add-ons, upgrades, docs, tutorials, and support benefits.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {configured} of {products.length} configured
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            Products
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {products.map((product) => (
            <div key={product.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded-lg border bg-background p-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">{product.name}</h2>
                    <Badge variant="outline">{product.type}</Badge>
                    <Badge variant={product.serviceProfile?.isPublished ? "default" : "secondary"}>
                      {product.serviceProfile ? (product.serviceProfile.isPublished ? "Published" : "Draft") : "Not configured"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.category ?? "Uncategorized"} / {product.status} / {product.slug}
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/products/service-management/${product.id}`}>
                  Manage <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))}

          {products.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No products found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
