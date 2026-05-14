import { Metadata } from "next"
import Link from "next/link"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { format } from "date-fns"

interface BlogPostProps {
  params: { slug: string }
}

export async function generateStaticParams() {
  const posts = await db.blogPost.findMany({ select: { slug: true } })
  return posts.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const { slug } = params
  const post = await db.blogPost.findUnique({ where: { slug } })
  if (!post) return { title: "Not Found" }
  return {
    title: `${post.title} - OpenClaude Blog`,
    description: post.excerpt,
  }
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const { slug } = params
  const post = await db.blogPost.findUnique({
    where: { slug },
    include: { author: true }
  })

  if (!post) {
    notFound()
  }

  const formattedDate = post.publishedAt ? format(post.publishedAt, "MMM dd, yyyy") : "Draft"

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <Link href="/blog" className="text-sm text-muted-foreground hover:text-primary mb-8 inline-block">
        ← Back to all posts
      </Link>

      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {post.tags.map(tag => (
              <span key={tag} className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">{tag}</span>
            ))}
            <span>{formattedDate}</span>
            <span>•</span>
            <span>5 min read</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-3 pt-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              👤
            </div>
            <div>
              <p className="font-medium text-sm">{post.author.name}</p>
              <p className="text-xs text-muted-foreground">{post.author.email}</p>
            </div>
          </div>
        </header>

        {/* Hero Image */}
        {post.coverImageUrl ? (
          <div className="aspect-[2/1] w-full bg-muted rounded-2xl flex items-center justify-center border overflow-hidden">
            <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="aspect-[2/1] w-full bg-muted rounded-2xl flex items-center justify-center border">
            <span className="text-muted-foreground">No Cover Image</span>
          </div>
        )}

        {/* Content Body */}
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          
          <h2>The Problem We're Solving</h2>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </p>
          
          <blockquote>
            "This marketplace has fundamentally changed how we approach AI integration in our enterprise." - Early Adopter
          </blockquote>

          <h3>Key Features</h3>
          <ul>
            <li>One-click integration with existing stacks</li>
            <li>Unified billing across all AI tools</li>
            <li>Enterprise-grade security and compliance</li>
            <li>Real-time performance analytics</li>
          </ul>

          <p>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 p-8 bg-muted rounded-2xl text-center space-y-4">
          <h3 className="text-2xl font-bold">Ready to get started?</h3>
          <p className="text-muted-foreground">Join thousands of developers building the future.</p>
          <Link href="/marketplace" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors">
            Explore the Marketplace
          </Link>
        </div>
      </article>
    </div>
  )
}
