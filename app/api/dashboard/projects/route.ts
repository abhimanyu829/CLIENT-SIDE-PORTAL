import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const where: any = { clientId: session.user.id }
    if (status && status !== "ALL") where.status = status

    const projects = await db.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ data: projects })
  } catch (err) {
    console.error("[projects GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { title, description } = await req.json()
    if (!title || !description) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const project = await db.project.create({
      data: {
        clientId: session.user.id,
        title,
        description,
        status: "DRAFT",
      },
    })

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PROJECT_REQUESTED",
        entity: "Project",
        entityId: project.id,
      }
    }).catch(() => {})

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (err) {
    console.error("[projects POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
