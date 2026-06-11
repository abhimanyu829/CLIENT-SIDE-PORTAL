import { Webhook } from "svix"
import { headers } from "next/headers"
import { WebhookEvent } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { auditLog, AUTH_EVENTS } from "@/lib/audit"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const SIGNING_SECRET = env.CLERK_WEBHOOK_SECRET

  if (!SIGNING_SECRET) {
    throw new Error("Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env")
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET)

  // Get headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  // Get body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error("Error verifying webhook:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const { id } = evt.data
  const eventType = evt.type

  if (eventType === "user.created" || eventType === "user.updated") {
    const { email_addresses, first_name, last_name, image_url } = evt.data
    const email = email_addresses[0]?.email_address

    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 400 })
    }

    const name = [first_name, last_name].filter(Boolean).join(" ") || email

    try {
      // Upsert user into database
      const user = await db.user.upsert({
        where: { email },
        update: {
          clerkUserId: id,
          name,
          avatarUrl: image_url,
          isVerified: true, // Clerk verified them
        },
        create: {
          email,
          name,
          clerkUserId: id,
          avatarUrl: image_url,
          isVerified: true,
        },
      })

      if (eventType === "user.created") {
        auditLog({
          userId: user.id,
          clerkUserId: id,
          action: AUTH_EVENTS.SIGNUP,
          metadata: { provider: "clerk" },
        })
      }

      return NextResponse.json({ success: true, userId: user.id }, { status: 200 })
    } catch (error) {
      console.error("Failed to sync user to database:", error)
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
  }

  if (eventType === "user.deleted") {
    try {
      // Find the user to get their internal ID
      const user = await db.user.findUnique({
        where: { clerkUserId: id },
      })

      if (user) {
        // Soft delete or anonymize (depends on your business logic)
        await db.user.update({
          where: { id: user.id },
          data: {
            clerkUserId: null,
            email: `deleted-${user.id}@nexus.local`,
            name: "Deleted User",
            isBanned: true,
          },
        })

        auditLog({
          userId: user.id,
          action: "USER_DELETED",
          metadata: { provider: "clerk", clerkUserId: id },
        })
      }

      return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
      console.error("Failed to process user.deleted:", error)
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
  }

  // Ignore other event types
  return NextResponse.json({ success: true }, { status: 200 })
}
