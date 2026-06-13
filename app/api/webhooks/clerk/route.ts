import { WebhookEvent } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { Webhook } from "svix"
import { auditLog, AUTH_EVENTS } from "@/lib/audit"
import { env } from "@/lib/env"
import {
  anonymizeDeletedClerkUser,
  profileFromClerkWebhookData,
  syncClerkUserToDatabase,
} from "@/lib/services/clerk-user-sync"

export async function POST(req: Request) {
  const signingSecret = env.CLERK_WEBHOOK_SECRET

  if (!signingSecret) {
    return NextResponse.json({ error: "Clerk webhook secret is not configured" }, { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get("svix-id")
  const svixTimestamp = headerPayload.get("svix-timestamp")
  const svixSignature = headerPayload.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const body = await req.text()
  let event: WebhookEvent

  try {
    event = new Webhook(signingSecret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent
  } catch (error) {
    console.error("Error verifying Clerk webhook:", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const profile = profileFromClerkWebhookData(event.data)
    if (!profile) {
      return NextResponse.json({ error: "No primary email found" }, { status: 400 })
    }

    try {
      const user = await syncClerkUserToDatabase(profile)

      if (event.type === "user.created") {
        auditLog({
          userId: user.id,
          clerkUserId: profile.id,
          action: AUTH_EVENTS.SIGNUP,
          metadata: { provider: "clerk" },
        })
      }

      return NextResponse.json({ success: true, userId: user.id })
    } catch (error) {
      console.error("Failed to sync Clerk user:", error)
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
  }

  if (event.type === "user.deleted") {
    try {
      const user = event.data.id ? await anonymizeDeletedClerkUser(event.data.id) : null

      if (user) {
        auditLog({
          userId: user.id,
          action: "USER_DELETED",
          metadata: { provider: "clerk", clerkUserId: event.data.id },
        })
      }

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Failed to process Clerk user.deleted:", error)
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
