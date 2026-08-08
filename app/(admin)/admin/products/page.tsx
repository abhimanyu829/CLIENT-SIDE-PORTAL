import { db } from "@/lib/db"
import AdminProductsClient from "./AdminProductsClient"
import { unstable_cache } from "next/cache"

/** Safely converts Date | string | null | undefined → ISO string | null */
function toIso(val: Date | string | null | undefined): string | null {
  if (val == null) return null
  if (val instanceof Date) return val.toISOString()
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

const getProducts = unstable_cache(
  async () => {
    return db.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        tiers: { orderBy: { sortOrder: "asc" } },
        versions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        stock: {
          include: {
            history: {
              orderBy: { createdAt: "desc" },
              take: 50,
            },
          },
        },
        _count: { select: { subscriptions: true, reviews: true } }
      }
    })
  },
  ["admin-products"],
  { tags: ["products"], revalidate: 30 }
)

export default async function AdminProductsPage() {
  const products = await getProducts()

  const serialized = products.map(p => ({
    ...p,
    tiers: p.tiers.map(t => ({
      ...t,
      price: Number(t.price),
      discountPrice: t.discountPrice ? Number(t.discountPrice) : null,
      introPrice: t.introPrice ? Number(t.introPrice) : null,
      flashSalePrice: t.flashSalePrice ? Number(t.flashSalePrice) : null,
      setupFee: t.setupFee ? Number(t.setupFee) : null,
      flashSaleEndsAt: toIso(t.flashSaleEndsAt),
      updatedAt: toIso(t.updatedAt) ?? "",
      createdAt: toIso(t.createdAt) ?? "",
    })),
    versions: (p.versions || []).map(v => ({
      ...v,
      createdAt: toIso(v.createdAt) ?? "",
    })),
    stock: p.stock
      ? {
          ...p.stock,
          createdAt: toIso(p.stock.createdAt) ?? "",
          updatedAt: toIso(p.stock.updatedAt) ?? "",
          history: (p.stock.history || []).map(h => ({
            ...h,
            createdAt: toIso(h.createdAt) ?? "",
          })),
        }
      : null,
    scheduledAt: toIso(p.scheduledAt),
    createdAt: toIso(p.createdAt) ?? "",
    updatedAt: toIso(p.updatedAt) ?? "",
  }))

  return <AdminProductsClient initialProducts={serialized as any} />
}
