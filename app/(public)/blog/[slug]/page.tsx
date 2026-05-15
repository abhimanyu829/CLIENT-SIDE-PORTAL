import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { format } from "date-fns"

interface BlogPostProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const posts = await db.blogPost.findMany({ where: { publishedAt: { not: null } }, select: { slug: true } })
    return posts.map(p => ({ slug: p.slug }))
  } catch { return [] }
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const { slug } = await params
  const post = await db.blogPost.findUnique({ where: { slug } })
  if (!post) return { title: "Not Found" }
  return {
    title: `${post.title} — NexusAI Blog`,
    description: post.excerpt ?? undefined,
    openGraph: { title: post.title, description: post.excerpt ?? undefined, images: post.coverImageUrl ? [post.coverImageUrl] : [] },
  }
}

async function getRelatedPosts(slug: string, tags: string[]) {
  try {
    return await db.blogPost.findMany({
      where: { publishedAt: { not: null }, slug: { not: slug } },
      take: 3,
      orderBy: { publishedAt: "desc" },
      include: { author: { select: { name: true } } },
    })
  } catch { return [] }
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const { slug } = await params
  const post = await db.blogPost.findUnique({
    where: { slug },
    include: { author: true },
  })
  if (!post) notFound()

  const tags: string[] = Array.isArray(post.tags) ? post.tags as string[] : []
  const related = await getRelatedPosts(slug, tags)
  const readTime = Math.max(1, Math.ceil((post.content?.split(" ").length ?? 300) / 200))

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .text-gradient { background: linear-gradient(135deg,#a78bfa,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .btn-gradient { background: linear-gradient(135deg,#6366f1,#8b5cf6); }
        .prose-dark h2 { font-size:1.75rem; font-weight:800; color:white; margin:2.5rem 0 1rem; }
        .prose-dark h3 { font-size:1.3rem; font-weight:700; color:white; margin:2rem 0 0.75rem; }
        .prose-dark p { color:#a1a1aa; line-height:1.9; margin-bottom:1.5rem; }
        .prose-dark code { background:rgba(139,92,246,0.15); color:#c4b5fd; padding:0.2em 0.5em; border-radius:0.35rem; font-size:0.875em; font-family:'Courier New',monospace; }
        .prose-dark pre { background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.5rem; overflow-x:auto; margin:1.5rem 0; }
        .prose-dark pre code { background:none; padding:0; color:#e4e4e7; }
        .prose-dark a { color:#a78bfa; text-decoration:underline; }
        .prose-dark strong { color:white; }
        .prose-dark blockquote { border-left:3px solid #8b5cf6; padding:1rem 1.5rem; background:rgba(139,92,246,0.08); border-radius:0 1rem 1rem 0; margin:1.5rem 0; }
        .prose-dark blockquote p { color:#c4b5fd; margin-bottom:0; }
        .prose-dark ul,ol { color:#a1a1aa; padding-left:1.5rem; margin-bottom:1.5rem; }
        .prose-dark li { margin-bottom:0.5rem; line-height:1.7; }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); border-color: rgba(139,92,246,0.4); }
      `}</style>

      {/* Hero Cover */}
      <div className="relative h-72 md:h-96 overflow-hidden">
        {post.coverImageUrl ? (
          <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-950 via-indigo-950 to-black flex items-center justify-center">
            <div className="absolute inset-0" style={{backgroundImage:"linear-gradient(rgba(139,92,246,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.05) 1px,transparent 1px)",backgroundSize:"60px 60px"}} />
            <span className="text-8xl">📝</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Link href="/blog" className="glass text-xs px-3 py-1.5 rounded-full text-zinc-400 hover:text-zinc-200 transition-colors">
                ← Blog
              </Link>
              {tags.slice(0,2).map(tag=>(
                <span key={tag} className="glass text-xs px-3 py-1.5 rounded-full text-purple-300">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Article */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* Main Article */}
          <article className="lg:col-span-3 pt-10 pb-20">
            {/* Title + Meta */}
            <header className="mb-10">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">{post.title}</h1>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">
                    {(post.author?.name ?? "N").charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{post.author?.name ?? "NexusAI Team"}</p>
                    <p className="text-xs text-zinc-600">
                      {post.publishedAt && format(new Date(post.publishedAt), "MMM d, yyyy")}
                      {" · "}{readTime} min read
                    </p>
                  </div>
                </div>
                {/* Share */}
                <div className="ml-auto flex gap-2">
                  {["𝕏","in","🔗"].map(s=>(
                    <button key={s} className="glass w-8 h-8 rounded-lg flex items-center justify-center text-xs text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            {/* Excerpt callout */}
            {post.excerpt && (
              <div className="glass rounded-2xl p-6 mb-8 border-l-2 border-l-purple-500">
                <p className="text-zinc-300 text-lg font-medium leading-relaxed italic">{post.excerpt}</p>
              </div>
            )}

            {/* Body */}
            <div className="prose-dark">
              {post.content ? (
                <div dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, "<br />") }} />
              ) : (
                <div className="space-y-4 text-zinc-400">
                  <p>This is a placeholder article. The full content will be published soon.</p>
                  <p>In the meantime, explore the <Link href="/marketplace" className="text-purple-400 underline">AI Marketplace</Link> or <Link href="/ai-agents" className="text-purple-400 underline">browse AI Agents</Link>.</p>
                </div>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="border-t border-white/5 pt-8 mt-8">
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag=>(
                    <span key={tag} className="glass text-xs px-3 py-1.5 rounded-full text-zinc-400 hover:text-zinc-200 hover:border-white/20 cursor-pointer transition-all">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Author box */}
            {post.author && (
              <div className="glass rounded-2xl p-6 mt-10">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl font-bold shrink-0">
                    {(post.author.name ?? "N").charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-lg mb-1">{post.author.name}</p>
                    <p className="text-zinc-500 text-sm">{post.author.bio ?? "Engineer at NexusAI. Building the future of AI infrastructure."}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Newsletter CTA */}
            <div className="glass rounded-2xl p-8 mt-10 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/10 pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-2">Enjoyed this article?</h3>
                <p className="text-zinc-400 mb-5">Get the latest AI engineering insights in your inbox.</p>
                <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
                  <input type="email" placeholder="you@startup.com" className="flex-1 glass rounded-xl px-4 py-3 text-sm placeholder-zinc-600 outline-none focus:border-purple-500/50 text-white" />
                  <button className="btn-gradient px-5 py-3 rounded-xl font-bold text-white text-sm hover:scale-105 transition-all">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </article>

          {/* TOC Sidebar */}
          <aside className="hidden lg:block pt-10">
            <div className="sticky top-20 space-y-4">
              <div className="glass rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-4">On this page</p>
                <nav className="space-y-2 text-sm text-zinc-500">
                  <a href="#" className="block hover:text-purple-300 transition-colors">Introduction</a>
                  <a href="#" className="block hover:text-purple-300 transition-colors">Key Concepts</a>
                  <a href="#" className="block hover:text-purple-300 transition-colors">Implementation</a>
                  <a href="#" className="block hover:text-purple-300 transition-colors">Best Practices</a>
                  <a href="#" className="block hover:text-purple-300 transition-colors">Conclusion</a>
                </nav>
              </div>

              {/* Floating share */}
              <div className="glass rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-3">Share</p>
                <div className="flex flex-col gap-2">
                  {[["𝕏","Share on X"],["in","LinkedIn"],["🔗","Copy Link"]].map(([icon,label])=>(
                    <button key={label} className="glass rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-all flex items-center gap-2">
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Related Posts */}
        {related.length > 0 && (
          <section className="border-t border-white/5 py-16">
            <h2 className="text-2xl font-black mb-8">Related Articles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {related.map((p, idx) => (
                <Link key={p.slug} href={`/blog/${p.slug}`}>
                  <div className="glass rounded-2xl overflow-hidden card-hover group">
                    <div className={`aspect-video bg-gradient-to-br ${["from-purple-900/60 to-blue-900/40","from-blue-900/60 to-indigo-900/40","from-indigo-900/60 to-purple-900/40"][idx % 3]} flex items-center justify-center`}>
                      <span className="text-3xl">📝</span>
                    </div>
                    <div className="p-4">
                      <p className="font-bold text-sm mb-1 group-hover:text-purple-300 transition-colors line-clamp-2">{p.title}</p>
                      <p className="text-xs text-zinc-600">{p.author?.name ?? "NexusAI Team"}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
