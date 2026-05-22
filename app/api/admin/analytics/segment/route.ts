import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  await requireAdmin()
  const body = await req.json()
  const { rules } = body

  // Rules structure:
  // {
  //   joinedDaysAgo: number (e.g. 30),
  //   minLtv: number (e.g. 100),
  //   activeDaysAgo: number (e.g. 7)
  // }

  const where: any = {}

  if (rules.joinedDaysAgo) {
    const joinedCutoff = new Date()
    joinedCutoff.setDate(joinedCutoff.getDate() - Number(rules.joinedDaysAgo))
    where.createdAt = { lte: joinedCutoff }
  }

  // To check active session times
  if (rules.activeDaysAgo) {
    const activeCutoff = new Date()
    activeCutoff.setDate(activeCutoff.getDate() - Number(rules.activeDaysAgo))
    where.sessions = {
      some: {
        createdAt: { gte: activeCutoff }
      }
    }
  }

  let users = await db.user.findMany({
    where,
    include: {
      payments: {
        where: { status: "SUCCESS" }
      }
    }
  })

  // Filter by minLtv since LTV is the sum of payments
  if (rules.minLtv) {
    const min = Number(rules.minLtv)
    users = users.filter((u) => {
      const ltv = u.payments.reduce((acc, curr) => acc + Number(curr.amount), 0)
      return ltv >= min
    })
  }

  return NextResponse.json({
    count: users.length,
    users: users.slice(0, 10).map(u => ({ id: u.id, name: u.name, email: u.email }))
  })
}
