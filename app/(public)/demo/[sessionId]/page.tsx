import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db"
import PreviewSandbox from "@/components/marketplace/PreviewSandbox"

interface DemoPageProps {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function DemoPage({ params, searchParams }: DemoPageProps) {
  const { sessionId } = await params
  const { token } = await searchParams

  // Token is required for enterprise preview sessions
  if (!token) {
    // Legacy: try to find by sessionToken (plain nanoid)
    const session = await db.demoSession.findUnique({
      where: { sessionToken: sessionId },
      include: { product: { select: { name: true, slug: true } } },
    })

    if (!session || session.isExpired || session.isRevoked) {
      return notFound()
    }

    const remaining = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))

    return (
      <PreviewSandbox
        sessionId={session.id}
        token={session.sessionToken}
        previewUrl={session.previewUrl}
        expiresAt={session.expiresAt.toISOString()}
        productName={session.product.name}
        productSlug={session.product.slug}
        remainingSeconds={remaining}
        isExpired={remaining <= 0}
        isRevoked={session.isRevoked}
      />
    )
  }

  // Enterprise: validate signed token
  try {
    const { validateSignedPreviewToken } = await import("@/lib/preview-token")
    const payload = await validateSignedPreviewToken(token)

    const session = await db.demoSession.findUnique({
      where: { id: payload.sessionId },
      include: { product: { select: { name: true, slug: true } } },
    })

    if (!session) return notFound()

    // Update analytics
    await db.demoSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date(), viewedPages: { increment: 1 } },
    })

    const remaining = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))

    return (
      <PreviewSandbox
        sessionId={session.id}
        token={token}
        previewUrl={session.previewUrl}
        expiresAt={session.expiresAt.toISOString()}
        productName={session.product.name}
        productSlug={session.product.slug}
        remainingSeconds={remaining}
        isExpired={session.isExpired || remaining <= 0}
        isRevoked={session.isRevoked}
      />
    )
  } catch {
    // Token invalid/expired/revoked
    redirect("/marketplace?preview_expired=true")
  }
}