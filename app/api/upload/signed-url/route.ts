import { NextResponse } from "next/server"
import { generatePresignedPutUrl } from "@/lib/r2"
import { auth } from "@/lib/auth"
import { env } from "@/lib/env"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const body = await req.json()
    const { filename, contentType, size } = body

    const MAX_SIZE = 5 * 1024 * 1024
    if (size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    const uniqueId = Math.random().toString(36).substring(2, 15)
    const key = `uploads/${session.user.id}/${uniqueId}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    const uploadUrl = await generatePresignedPutUrl(key, contentType)
    
    const publicUrl = `${env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`

    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (error: any) {
    console.error("[API/Upload] Error generating signed URL:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
