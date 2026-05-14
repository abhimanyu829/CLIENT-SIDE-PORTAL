import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/leads — list CRM leads (admin only)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const stage = searchParams.get("stage") ?? undefined
    const search = searchParams.get("q") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"))
    const skip = (page - 1) * limit

    const where = {
      ...(stage ? { stage: stage as any } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
              { company: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        orderBy: { score: "desc" },
        skip,
        take: limit,
        include: {
          assignee: { select: { name: true, avatarUrl: true } },
          interactions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      db.lead.count({ where }),
    ])

    return NextResponse.json({
      data: leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("[leads] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/leads — create a new CRM lead
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (role !== "SUPER_ADMIN" && role !== "SUB_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { email, name, phone, company, source, stage, score, assignedTo, notes } =
      await req.json()

    if (!email || !source) {
      return NextResponse.json({ error: "email and source are required" }, { status: 400 })
    }

    const lead = await db.lead.create({
      data: {
        email,
        name,
        phone,
        company,
        source,
        stage: stage ?? "NEW",
        score: score ?? 0,
        assignedTo,
        notes,
      },
    })

    return NextResponse.json({ data: lead }, { status: 201 })
  } catch (err) {
    console.error("[leads] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
