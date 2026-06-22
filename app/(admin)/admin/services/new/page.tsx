import { db } from "@/lib/db"
import NewServiceClient from "./NewServiceClient"

export default async function NewServicePage({ searchParams }: { searchParams?: Promise<{ category?: string }> }) {
  const { category } = (await searchParams) ?? {}
  const categories = await db.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  const initialCategoryId = category
    ? categories.find((item) => item.slug === category)?.id ?? ""
    : ""

  return <NewServiceClient categories={categories} initialCategoryId={initialCategoryId} />
}
