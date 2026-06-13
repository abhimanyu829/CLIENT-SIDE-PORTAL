import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/layout/Providers"
import { ClerkProvider } from "@clerk/nextjs"
import { clerkAppearance } from "@/lib/clerk"

export const metadata: Metadata = {
  title: {
    default: "OpenClaude - AI SaaS Platform",
    template: "%s - OpenClaude",
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
    >
      <html lang="en" suppressHydrationWarning>
        <body className="font-sans antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
