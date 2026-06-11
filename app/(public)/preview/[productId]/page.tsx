import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import PreviewClient from "./PreviewClient"

interface Props {
  params: Promise<{ productId: string }>
}

export default async function PreviewPage({ params }: Props) {
  const { productId } = await params

  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      thumbnailUrl: true,
      previewEnabled: true,
      previewConfig: true,
      status: true,
      type: true,
    },
  })

  if (!product || !product.previewEnabled) {
    notFound()
  }

  return <PreviewClient product={product} />
}