import { redirect } from "next/navigation"

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/products/${id}/access-config`)
}
