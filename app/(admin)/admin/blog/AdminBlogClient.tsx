"use client"

import { useState } from "react"
import Link from "next/link"
import {
  FileText,
  Plus,
  ExternalLink,
  Eye,
  CheckCircle2,
  Calendar,
  Sparkles,
  Search,
  X,
  Upload,
  Layers,
  BookOpen,
  Trash2,
} from "lucide-react"

interface BlogPostItem {
  id: string
  title: string
  slug: string
  excerpt: string
  contentMdx: string
  coverImageUrl: string | null
  tags: string[]
  readingTime: number
  viewCount: number
  publishedAt: string | null
  createdAt: string
  author: {
    name: string | null
    email: string | null
    avatarUrl: string | null
  } | null
}

interface Props {
  initialPosts: BlogPostItem[]
}

const DEFAULT_CATEGORIES = ["AI", "Engineering", "SaaS", "Startup", "Deployment", "Automation", "Security", "Product Updates"]

export default function AdminBlogClient({ initialPosts }: Props) {
  const [posts, setPosts] = useState<BlogPostItem[]>(initialPosts)
  const [searchQuery, setSearchQuery] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const handleDeletePost = async (id: string, postTitle: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${postTitle}"?`)) {
      return
    }

    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/blog?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPosts((prev) => prev.filter((p) => p.id !== id))
      } else {
        alert(data.error || "Failed to delete post.")
      }
    } catch {
      alert("Network error while deleting post.")
    } finally {
      setDeletingId(null)
    }
  }

  // Form state
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [contentMdx, setContentMdx] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [selectedTag, setSelectedTag] = useState("Engineering")
  const [isPublished, setIsPublished] = useState(true)

  // Live auto-slug
  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      )
    }
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMsg("")

    if (!title.trim() || !excerpt.trim() || !contentMdx.trim()) {
      setError("Please fill in Title, Excerpt, and Content.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: slug.trim() || undefined,
          excerpt,
          contentMdx,
          coverImageUrl: coverImageUrl.trim() || undefined,
          tags: [selectedTag],
          isPublished,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg(`Post published! View at ${data.url}`)
        setPosts((prev) => [
          {
            ...data.post,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: isPublished ? new Date().toISOString() : null,
            author: { name: "You (Admin)", email: "", avatarUrl: null },
          },
          ...prev,
        ])
        // Reset form
        setTitle("")
        setSlug("")
        setExcerpt("")
        setContentMdx("")
        setCoverImageUrl("")
        setTimeout(() => {
          setIsModalOpen(false)
          setSuccessMsg("")
        }, 1500)
      } else {
        setError(data.error || "Failed to create post.")
      }
    } catch {
      setError("Network error while submitting post.")
    } finally {
      setSubmitting(false)
    }
  }

  const filteredPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const publishedCount = posts.filter((p) => Boolean(p.publishedAt)).length
  const totalViews = posts.reduce((acc, p) => acc + (p.viewCount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Blog &amp; Publication Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish engineering articles, guides, and tutorials directly to{" "}
            <Link href="/blog" target="_blank" className="text-primary underline inline-flex items-center gap-0.5">
              /blog <ExternalLink className="w-3 h-3" />
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/blog"
            target="_blank"
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            View Public Blog
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Upload New Blog Post
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Articles", val: posts.length, icon: Layers },
          { label: "Published Live", val: publishedCount, icon: CheckCircle2 },
          { label: "Drafts", val: posts.length - publishedCount, icon: FileText },
          { label: "Total Views", val: totalViews, icon: Eye },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border/60 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">{s.label}</span>
              <s.icon className="w-4 h-4 text-primary/70" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, slug, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-4">Post Title</th>
                <th className="p-4">Tags</th>
                <th className="p-4">Status</th>
                <th className="p-4">Reading Time</th>
                <th className="p-4">Published Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <p className="font-semibold text-sm mb-1">No articles found</p>
                    <p className="text-xs">Click "Upload New Blog Post" above to publish your first article.</p>
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 max-w-sm">
                      <p className="font-bold text-foreground text-sm truncate">{post.title}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">/blog/{post.slug}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {post.tags.map((t) => (
                          <span
                            key={t}
                            className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-semibold"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      {post.publishedAt ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">{post.readingTime} min</td>
                    <td className="p-4 text-muted-foreground">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Unpublished"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-muted hover:bg-muted/80 text-foreground inline-flex items-center gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id, post.title)}
                          disabled={deletingId === post.id}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          {deletingId === post.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Upload New Blog Post */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in duration-150 my-8">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">Upload New Blog Post</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 text-xs rounded-lg">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs rounded-lg font-medium">
                  {successMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Article Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scaling Real-Time AI Workflows with Next.js & WebSockets"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">URL Slug</label>
                  <input
                    type="text"
                    placeholder="scaling-realtime-ai-workflows"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Category / Tag</label>
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Cover Image URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Short Excerpt *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="A short 1-2 sentence preview for search results and social cards..."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-foreground">Article Content (Markdown / MDX) *</label>
                  <span className="text-[11px] text-muted-foreground">Supports ## Headings, lists, code blocks</span>
                </div>
                <textarea
                  rows={8}
                  required
                  placeholder={`## Introduction\n\nWrite your blog content here. You can use standard Markdown:\n\n- Point 1\n- Point 2\n\n### Key Takeaways\n\nExplain technical insights clearly...`}
                  value={contentMdx}
                  onChange={(e) => setContentMdx(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="publishCheckbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="publishCheckbox" className="text-xs font-semibold text-foreground cursor-pointer">
                  Publish immediately (will show on /blog right away)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Uploading..." : "Publish to /blog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

