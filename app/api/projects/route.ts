import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/projects — list projects
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN"

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "10"))
    const skip = (page - 1) * limit

    const where = {
      ...(isAdmin ? {} : { clientId: session.user.id }),
      ...(status ? { status: status as any } : {}),
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          client: { select: { name: true, email: true, avatarUrl: true } },
          manager: { select: { name: true, avatarUrl: true } },
          _count: { select: { tickets: true, files: true } },
        },
      }),
      db.project.count({ where }),
    ])

    return NextResponse.json({
      data: projects,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("[projects] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/projects — create a new project (admin)
export async function POST(req: Request) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { title, description, clientId, managerId, deadline, budget, currency, tags } =
      await req.json()

    if (!title || !clientId) {
      return NextResponse.json({ error: "title and clientId are required" }, { status: 400 })
    }

    const project = await db.project.create({
      data: {
        title,
        description: description ?? "",
        clientId,
        managerId,
        deadline: deadline ? new Date(deadline) : undefined,
        budget,
        currency: currency ?? "USD",
        tags: tags ?? [],
        milestones: [],
      },
    })

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (err) {
    console.error("[projects] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
