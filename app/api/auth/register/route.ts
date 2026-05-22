import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hash } from "bcryptjs"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 409 }
      )
    }

    const passwordHash = await hash(password, 10)

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    })

    return NextResponse.json(
      { message: "User registered successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("[register] POST:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
