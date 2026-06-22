import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import ProductAccessConfigClient from "./ProductAccessConfigClient"

export const metadata = { title: "Access Config — Admin" }

export default async function ProductAccessConfigPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!["SUPER_ADMIN", "SUB_ADMIN"].includes(session.user.role)) redirect("/dashboard")

  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      productAccessUrl: true,
      productLoginUrl: true,
      productDashboardUrl: true,
      productAccessNotes: true,
    },
  })
  if (!product) notFound()

  return <ProductAccessConfigClient product={product} />
}
