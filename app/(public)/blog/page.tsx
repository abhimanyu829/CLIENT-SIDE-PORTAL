import { Metadata } from "next"
import Link from "next/link"
import { db } from "@/lib/db"

export const metadata: Metadata = {
  title: "Blog - OpenClaude Platform",
  description: "Latest news, updates, and insights from the OpenClaude team.",
}

async function getPosts() {
  return await db.blogPost.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    include: { author: { select: { name: true, avatarUrl: true } } }
  })
}

export default async function BlogListPage() {
  const posts = await getPosts()
  
  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="text-center space-y-4 mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">The OpenClaude Blog</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Insights, updates, and deep dives into the world of artificial intelligence and workflow automation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="group block h-full">
            <div className="border rounded-2xl overflow-hidden bg-card h-full flex flex-col transition-all hover:shadow-md hover:border-primary/50">
              {/* Cover Image Placeholder */}
              <div className="aspect-video bg-muted relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-colors"></div>
                {post.tags && post.tags.length > 0 && (
                  <div className="absolute top-4 left-4 bg-background/90 backdrop-blur text-xs font-semibold px-3 py-1 rounded-full">
                    {String(post.tags[0])}
                  </div>
                )}
              </div>
              
              <div className="p-6 flex flex-col flex-1">
                <div className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString()}</span>}
                  <span>•</span>
                  <span>{post.author?.name ?? "OpenClaude"}</span>
                </div>
                <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="text-muted-foreground mb-6 flex-1">
                  {post.excerpt}
                </p>
                <div className="text-primary font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all mt-auto">
                  Read Article <span>→</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
