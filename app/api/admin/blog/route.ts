import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

const createBlogPostSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(200),
  slug: z.string().optional(),
  excerpt: z.string().min(5, "Excerpt must be at least 5 characters").max(500),
  contentMdx: z.string().min(10, "Content must be at least 10 characters"),
  coverImageUrl: z.string().url().optional().or(z.literal("")).transform(v => v || null),
  tags: z.array(z.string()).default(["Engineering"]),
  readingTime: z.number().int().positive().optional(),
  isPublished: z.boolean().default(true),
})

export async function GET() {
  try {
    const session = await auth().catch(() => null)
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const posts = await db.blogPost.findMany({
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true, email: true, avatarUrl: true } } },
    })

    return NextResponse.json({ success: true, posts })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth().catch(() => null)
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createBlogPostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Auto-generate slug from title if not provided
    const baseSlug = (data.slug?.trim() || data.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    let finalSlug = baseSlug
    let counter = 1
    while (await db.blogPost.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter}`
      counter++
    }

    // Determine author ID
    let authorId = session.user.id
    const userExists = await db.user.findUnique({ where: { id: authorId } })
    if (!userExists) {
      const fallbackAdmin = await db.user.findFirst({
        where: { role: "SUPER_ADMIN" },
        select: { id: true },
      })
      if (fallbackAdmin) {
        authorId = fallbackAdmin.id
      }
    }

    // Estimate reading time if not provided (words / 200)
    const words = data.contentMdx.trim().split(/\s+/).length
    const computedReadingTime = data.readingTime || Math.max(1, Math.ceil(words / 200))

    const newPost = await db.blogPost.create({
      data: {
        title: data.title.trim(),
        slug: finalSlug,
        excerpt: data.excerpt.trim(),
        contentMdx: data.contentMdx.trim(),
        coverImageUrl: data.coverImageUrl,
        tags: data.tags.length > 0 ? data.tags : ["Engineering"],
        readingTime: computedReadingTime,
        authorId,
        publishedAt: data.isPublished ? new Date() : null,
      },
    })

    // Instant revalidation of blog listings and detail page
    revalidatePath("/blog")
    revalidatePath(`/blog/${finalSlug}`)

    return NextResponse.json({
      success: true,
      message: "Blog post published successfully!",
      post: newPost,
      url: `/blog/${finalSlug}`,
    })
  } catch (err: any) {
    console.error("[CREATE-BLOG-ERROR]", err)
    return NextResponse.json({ success: false, error: err.message || "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth().catch(() => null)
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, error: "Post ID is required" }, { status: 400 })
    }

    const post = await db.blogPost.findUnique({ where: { id } })
    if (!post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 })
    }

    await db.blogPost.delete({ where: { id } })

    revalidatePath("/blog")
    revalidatePath(`/blog/${post.slug}`)

    return NextResponse.json({
      success: true,
      message: "Blog post deleted successfully",
    })
  } catch (err: any) {
    console.error("[DELETE-BLOG-ERROR]", err)
    return NextResponse.json({ success: false, error: err.message || "Failed to delete post" }, { status: 500 })
  }
}

