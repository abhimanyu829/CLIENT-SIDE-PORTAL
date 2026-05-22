import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import InvoicesClient from "@/components/dashboard/InvoicesClient"

export default async function InvoicesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  
  // We'll let the client side handle fetching and pagination to make it feel real-time and snappy.
  return <InvoicesClient />
}
