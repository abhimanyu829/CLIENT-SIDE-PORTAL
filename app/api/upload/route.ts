import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generatePresignedPutUrl } from "@/lib/r2"
import { randomUUID } from "crypto"

// POST /api/upload — create a presigned PUT URL for direct-to-R2 upload
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { filename, contentType, folder = "uploads" } = await req.json()

    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 })
    }

    // Sanitize filename and create a unique key
    const ext = filename.split(".").pop()?.toLowerCase() ?? "bin"
    const key = `${folder}/${session.user.id}/${randomUUID()}.${ext}`

    // Generate 15-minute presigned PUT URL
    const uploadUrl = await generatePresignedPutUrl(key, contentType, 900)

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""}/${key}`

    return NextResponse.json({ uploadUrl, key, publicUrl })
  } catch (err) {
    console.error("[upload] POST:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
