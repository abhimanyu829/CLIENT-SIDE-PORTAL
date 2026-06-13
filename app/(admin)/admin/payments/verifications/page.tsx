import { requireSuperAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import VerificationsClient from "./VerificationsClient"

export const dynamic = "force-dynamic"

export default async function AdminPaymentVerificationsPage() {
  await requireSuperAdmin()

  const verifications = await db.paymentVerification.findMany({
    where: { verificationStatus: "AWAITING_VERIFICATION" },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, slug: true } },
              tier: { select: { id: true, name: true, interval: true } },
            },
          },
        }
      },
      user: {
        select: { email: true, name: true }
      }
    },
    orderBy: { submittedAt: "desc" }
  })

  const serialize = (obj: any): any => {
    if (obj === null || obj === undefined) return obj
    if (obj instanceof Date) return obj.toISOString()
    if (typeof obj === "bigint") return String(obj)
    if (obj?.constructor?.name === "Decimal" || (obj && typeof obj === "object" && "s" in obj && "e" in obj && "d" in obj)) return String(obj)
    if (Array.isArray(obj)) return obj.map(serialize)
    if (typeof obj === "object") {
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
    }
    return obj
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Payment Verifications</h1>
        <p className="text-zinc-400">Review and approve manual UPI payment submissions.</p>
      </div>
      <VerificationsClient initialData={serialize(verifications)} />
    </div>
  )
}
