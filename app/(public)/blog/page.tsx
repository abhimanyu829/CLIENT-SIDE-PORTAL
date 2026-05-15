import { Metadata } from "next"
import Link from "next/link"
import { db } from "@/lib/db"

export const metadata: Metadata = {
  title: "Blog — NexusAI Engineering",
  description: "Deep dives into AI infrastructure, SaaS engineering, deployment strategies, and the future of AI software.",
}

const CATEGORIES = ["All","AI","Engineering","SaaS","Startup","Deployment","Automation","Security","Product Updates"]

async function getPosts() {
  try {
    return await db.blogPost.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      include: { author: { select: { name: true, avatarUrl: true } } },
    })
  } catch { return [] }
}

function readingTime(content: string | null) {
  if (!content) return "3 min read"
  const words = content.split(" ").length
  return `${Math.max(1, Math.ceil(words / 200))} min read`
}

const GRADIENT_VARIANTS = [
  "from-purple-900/60 to-blue-900/40",
  "from-blue-900/60 to-indigo-900/40",
  "from-indigo-900/60 to-purple-900/40",
  "from-violet-900/60 to-blue-900/40",
]

export default async function BlogListPage() {
  const posts = await getPosts()
  const [featured, ...rest] = posts

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .text-gradient { background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .btn-gradient { background: linear-gradient(135deg,#6366f1,#8b5cf6); }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); border-color: rgba(139,92,246,0.4); box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(139,92,246,0.08); }
      `}</style>

      {/* Hero */}
      <section className="relative py-24 px-4 text-center overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        {/* Grid */}
        <div className="absolute inset-0 opacity-20" style={{backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",backgroundSize:"60px 60px"}} />
        <div className="max-w-3xl mx-auto relative z-10">
          <p className="text-purple-400 font-mono text-sm tracking-widest uppercase mb-4">The NexusAI Blog</p>
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-6">
            <span className="text-white">Engineering</span><br />
            <span className="text-gradient">the Future</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
            Deep dives into AI infrastructure, SaaS architecture, deployment strategies, and building developer ecosystems.
          </p>
          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <input
              type="search"
              placeholder="Search articles..."
              className="w-full glass rounded-xl px-5 py-4 text-white placeholder-zinc-600 outline-none focus:border-purple-500/50 pr-12 text-sm"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">⌘K</span>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto">
          {CATEGORIES.map((cat,i)=>(
            <button key={cat} className={`rounded-lg px-4 py-2 text-xs font-medium whitespace-nowrap transition-all ${i===0 ? "glass bg-purple-900/30 border-purple-500/50 text-purple-300" : "glass text-zinc-500 hover:text-zinc-300 hover:border-white/20"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">

        {/* Featured Article */}
        {featured && (
          <div className="mb-16">
            <p className="text-purple-400 font-mono text-xs tracking-widest uppercase mb-6">⭐ Featured Article</p>
            <Link href={`/blog/${featured.slug}`}>
              <div className="glass rounded-3xl overflow-hidden card-hover group">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Cover */}
                  <div className={`aspect-video lg:aspect-auto min-h-64 bg-gradient-to-br ${GRADIENT_VARIANTS[0]} relative overflow-hidden`}>
                    {featured.coverImageUrl ? (
                      <img src={featured.coverImageUrl} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-6xl mb-4">📝</div>
                          {featured.tags && Array.isArray(featured.tags) && (featured.tags as string[]).length > 0 && (
                            <span className="glass text-sm px-3 py-1 rounded-full text-purple-300">
                              {(featured.tags as string[])[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/40 lg:block hidden" />
                  </div>

                  {/* Content */}
                  <div className="p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                      {featured.tags && Array.isArray(featured.tags) && (featured.tags as string[]).slice(0,2).map(tag=>(
                        <span key={tag} className="glass text-xs px-3 py-1 rounded-full text-purple-300">{tag}</span>
                      ))}
                    </div>
                    <h2 className="text-3xl font-black mb-4 group-hover:text-gradient transition-all">{featured.title}</h2>
                    <p className="text-zinc-400 mb-6 leading-relaxed">{featured.excerpt}</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">
                          {(featured.author?.name ?? "N").charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{featured.author?.name ?? "NexusAI Team"}</p>
                          <p className="text-xs text-zinc-600">
                            {featured.publishedAt && new Date(featured.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                            {" · "}{readingTime(featured.content)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Articles Grid */}
        {rest.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black">Latest Articles</h2>
              <span className="text-zinc-600 text-sm">{rest.length} articles</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {rest.map((post, idx) => (
                <Link key={post.slug} href={`/blog/${post.slug}`}>
                  <article className="glass rounded-2xl overflow-hidden card-hover group h-full flex flex-col">
                    {/* Cover */}
                    <div className={`aspect-video bg-gradient-to-br ${GRADIENT_VARIANTS[idx % GRADIENT_VARIANTS.length]} relative overflow-hidden`}>
                      {post.coverImageUrl ? (
                        <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-4xl">
                            {post.tags && Array.isArray(post.tags) && (post.tags as string[])[0] === "AI" ? "🤖" :
                             (post.tags as string[])?.[0] === "Engineering" ? "⚙️" :
                             (post.tags as string[])?.[0] === "Security" ? "🔐" : "📝"}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      {post.tags && Array.isArray(post.tags) && (post.tags as string[]).length > 0 && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-black/70 backdrop-blur text-xs font-semibold px-2.5 py-1 rounded-full text-purple-300">
                            {(post.tags as string[])[0]}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center gap-2 text-xs text-zinc-600 mb-3">
                        {post.publishedAt && (
                          <span>{new Date(post.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                        )}
                        <span>·</span>
                        <span>{readingTime(post.content)}</span>
                      </div>
                      <h3 className="text-lg font-bold mb-3 group-hover:text-purple-300 transition-colors leading-snug flex-1">
                        {post.title}
                      </h3>
                      <p className="text-zinc-500 text-sm mb-4 line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">
                            {(post.author?.name ?? "N").charAt(0)}
                          </div>
                          <span className="text-xs text-zinc-600">{post.author?.name ?? "NexusAI Team"}</span>
                        </div>
                        <span className="text-xs text-purple-400 font-medium group-hover:underline">
                          Read →
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {posts.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📝</div>
            <h2 className="text-2xl font-bold mb-2">No posts yet</h2>
            <p className="text-zinc-500 mb-8">The first articles are coming soon. Subscribe to get notified.</p>
            <button className="btn-gradient px-6 py-3 rounded-xl font-bold text-white hover:scale-105 transition-all inline-block">
              Subscribe to Newsletter
            </button>
          </div>
        )}

        {/* Newsletter CTA */}
        <div className="glass rounded-3xl p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/10 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-3">Stay in the loop</h2>
            <p className="text-zinc-400 mb-8">Get the latest AI engineering insights delivered to your inbox.</p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="you@startup.com"
                className="flex-1 glass rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50"
              />
              <button className="btn-gradient px-6 py-3 rounded-xl font-bold text-white text-sm hover:scale-105 transition-all whitespace-nowrap">
                Subscribe →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
