import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"


// GET /api/products — list published products with filters
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") ?? undefined
    const search = searchParams.get("q") ?? undefined
    const minPrice = searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : undefined
    const maxPrice = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined
    const rating = searchParams.get("rating") ? parseFloat(searchParams.get("rating")!) : undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "12"))
    const skip = (page - 1) * limit
    const sortBy = searchParams.get("sort") ?? "createdAt"

    const where: any = {
      status: "AVAILABLE" as const,
      ...(type ? { type: type as any } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { tagline: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(rating ? { averageRating: { gte: rating } } : {}),
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.tiers = {
        some: {
          isActive: true,
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          }
        }
      };
    }

    const orderBy: any =
      sortBy === "rating"
        ? { averageRating: "desc" }
        : sortBy === "popular"
        ? { viewCount: "desc" }
        : { createdAt: "desc" }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          tiers: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
        },
      }),
      db.product.count({ where }),
    ])

    return NextResponse.json({
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("[products] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
// POST /api/products — admin: create a new product
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { name, slug, tagline, description, type, features, techStack } = body

    if (!name || !slug || !type) {
      return NextResponse.json({ error: "name, slug, and type are required" }, { status: 400 })
    }

    const product = await db.product.create({
      data: {
        name,
        slug,
        tagline: tagline ?? "",
        description: description ?? "",
        type,
        features: features ?? [],
        techStack: techStack ?? [],
        createdBy: session!.user!.id!,
      },
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 })
    }
    console.error("[products] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
