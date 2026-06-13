import { NextRequest, NextResponse } from "next/server"
import { VendorType } from "@prisma/client"
import { auth } from "@/lib/auth"
import { createOrUpdateVendorProfile } from "@/lib/services/enterprise-commerce-service"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  if (!body.slug || !body.displayName || !body.type) {
    return NextResponse.json({ error: "slug, displayName, and type are required" }, { status: 400 })
  }

  if (!Object.values(VendorType).includes(body.type)) {
    return NextResponse.json({ error: "Unsupported vendor type" }, { status: 400 })
  }

  const vendor = await createOrUpdateVendorProfile(session.user.id, {
    slug: body.slug,
    displayName: body.displayName,
    type: body.type,
    headline: body.headline,
    description: body.description,
    websiteUrl: body.websiteUrl,
    supportEmail: body.supportEmail,
  })

  return NextResponse.json({ data: vendor }, { status: 201 })
}
