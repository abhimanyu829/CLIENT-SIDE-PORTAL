import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import VerificationsClient from "./VerificationsClient"

export const dynamic = "force-dynamic"

export default async function AdminPaymentVerificationsPage() {
  await requireAdmin()

  const verifications = await db.paymentVerification.findMany({
    where: { verificationStatus: "AWAITING_VERIFICATION" },
    include: {
      order: {
        include: { items: true }
      },
      user: {
        select: { email: true, name: true }
      }
    },
    orderBy: { submittedAt: "desc" }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Payment Verifications</h1>
        <p className="text-zinc-400">Review and approve manual UPI payment submissions.</p>
      </div>
      <VerificationsClient initialData={verifications} />
    </div>
  )
}
