import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/layout/Providers"
import { ClerkProvider } from "@clerk/nextjs"
import { ui } from "@clerk/ui"
import { clerkAppearance } from "@/lib/clerk"
import { AiSupportWidget } from "@/components/ai-support/AiSupportWidget"

export const metadata: Metadata = {
  title: {
    default: "ABHIBHIDEVELOPERS GROUP - AI SaaS Platform",
    template: "%s - ABHIBHIDEVELOPERS GROUP",
  },
  description:
    "Deploy AI agents, manage subscriptions, and automate your business workflows with OpenClaude.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/register"
      afterSignOutUrl="/"
      appearance={clerkAppearance}
      ui={ui}
    >
      <html lang="en" suppressHydrationWarning>
        <body className="light-theme font-sans antialiased">
          <Providers>{children}</Providers>
          <AiSupportWidget />
        </body>
      </html>
    </ClerkProvider>
  )
}
