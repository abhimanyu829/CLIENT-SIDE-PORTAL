import Link from "next/link"
import { db } from "@/lib/db"
import { ProductStatus, ProductType } from "@prisma/client"

export const metadata = {
  title: "AI Agents — Marketplace",
  description: "Discover and deploy powerful AI agents for your business workflows.",
}

async function getAgents() {
  return db.product.findMany({
    where: { status: ProductStatus.PUBLISHED, type: ProductType.AI_AGENT },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      thumbnailUrl: true,
      averageRating: true,
    },
  })
}

export default async function AIAgentsPage() {
  const agents = await getAgents()

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">AI Agents</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Explore our library of intelligent AI agents ready to automate your workflows.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/ai-agents/${agent.slug}`}
            className="group border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all bg-background"
          >
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-2xl mb-4">
              🤖
            </div>
            <h2 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{agent.name}</h2>
            <p className="text-sm text-muted-foreground line-clamp-2">{agent.tagline ?? agent.description}</p>
            {agent.averageRating > 0 && (
              <div className="flex items-center gap-1 mt-3 text-amber-500 text-sm">
                ★ <span className="font-semibold">{agent.averageRating.toFixed(1)}</span>
              </div>
            )}
          </Link>
        ))}

        {agents.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            No AI agents available yet. Check back soon!
          </div>
        )}
      </div>
    </div>
  )
}
