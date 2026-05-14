# Established Patterns

## API Route Pattern
```ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" }}, { status: 401 })
    // business logic
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error({ error }, "API error")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }}, { status: 500 })
  }
}
```

## Zod + react-hook-form Pattern
```ts
const schema = z.object({ email: z.string().email(), password: z.string().min(8) })
type FormData = z.infer<typeof schema>
const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })
```

## Cursor Pagination Pattern
```ts
const { cursor, limit = 20 } = Object.fromEntries(req.nextUrl.searchParams)
const items = await db.model.findMany({
  take: limit + 1, cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: "desc" }
})
const hasMore = items.length > limit
return NextResponse.json({ success: true, data: items.slice(0, limit), meta: { hasMore, nextCursor: hasMore ? items[limit - 1].id : null }})
```

## BullMQ Job Pattern
```ts
// Enqueue
await emailQueue.add("send-welcome", { userId, email }, { attempts: 3, backoff: { type: "exponential", delay: 2000 }})
// Process
export async function processEmail(job: Job) {
  const { userId, email } = job.data
  // send email
}
```

## Pusher Notification Pattern
```ts
// Server: trigger
await pusherServer.trigger(`private-user-${userId}`, "notification:new", { title, body, type })
// Client: subscribe
const channel = pusherClient.subscribe(`private-user-${session.user.id}`)
channel.bind("notification:new", (data) => notifStore.addNotification(data))
```
