import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import InvoicesClient from "./InvoicesClient"

export default async function InvoicesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const invoices = await db.invoice.findMany({
    where: { userId: session.user.id },
    orderBy: { issuedAt: "desc" }
  })

  return <InvoicesClient invoices={invoices} />
}
