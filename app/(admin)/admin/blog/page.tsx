import { db } from "@/lib/db"
import AdminBlogClient from "./AdminBlogClient"

export const dynamic = "force-dynamic"

export default async function AdminBlogPage() {
  const posts = await db.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: {
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  })

  const serializedPosts = posts.map((post) => ({
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
  }))

  return <AdminBlogClient initialPosts={serializedPosts} />
}

